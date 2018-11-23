'use strict';
const roller = require('./dice-roller');
const validator = require('./validator');
const base64url = require('base64-url');
const emailManager = require('./email-manager.js');
const dbhandler = require('./db-handler');

const registrationMiddleware = async (req, res, next) => {
	const errors = [];
	const checkPromises = [req.body.email1, req.body.email2].map((email) => (
		new Promise((resolve) => dbhandler.checkMail(email, result => {
			if (!result) {
				errors.push(`Email "${email}" not registered.`);
			}
			resolve();
		}))
	));
	for (const promise in checkPromises) {
		await promise;
	}
	if (errors.length > 0) {
		res.status(403).json({
			status: 'Error',
			errors: errors
		});
	} else {
		next();
	}
};

const handleRoll = async (req, res) => {
		req.params.max = parseInt(req.params.max);
		req.params.times = parseInt(req.params.times);
		if (validateRollArgs(req, res)) {
			const dice = await roller.roll(req.params.max, req.params.times);
			const now = new Date();
			const signature = validator.sign(pushToCopy(dice, now.getTime()));
			res.json({
				status: 'OK',
				result: {
					dice: dice,
					signature: {
						plain: signature,
						urlescaped: base64url.escape(signature)
					},
					date: now.toISOString()
				}
			})
		}
};

const validateRollArgs = (req, res) => {
	const errors = [];
	for (const name in ['max', 'times']) {
		if (!req.params[name]) {
			errors.push(name + ' parameter is not defined');
		} else if (!Number.isInteger(req.params[name])) {
			errors.push(name + ' parameter is not a valid number');
		}
	}
	if (errors.length > 0) {
		res.status(422).json({
			status: 'Error',
			errors: errors
		});
		return false;
	}
	return true;
};

const handleVerify = (req, res) => {
	req.params.signature = base64url.unescape(req.params.signature);
	if (validateVerifyArgs(req, res)) {
		req.params.diceArray.push(new Date(req.params.date).getTime());
		const valid = validator.verify(req.params.diceArray, req.params.signature);
		res.json({
			status: 'OK',
			valid: valid
		});
	}
};

const validateVerifyArgs = (req, res) => {
	const errors = [];
	try {
		req.params.diceArray = JSON.parse(req.params.diceArray);
	} catch (e) {
		if (e instanceof SyntaxError) {
			errors.push('The supplied diceArray parameter is invalid JSON.');
		} else {
			throw e;
		}
	}
	if (errors.length === 0) {
		if (Array.isArray(req.params.diceArray)) {
			req.params.diceArray = req.params.diceArray.map(o => parseInt(o));
			if (req.params.diceArray.some(Number.isNaN)) {
				errors.push('The provided diceArray parameter contains values other than integers.');
			}
		} else{
			errors.push('The provided diceArray parameter is not an array.');
		}
	}
	if (req.params.signature.length !== 684) {
		errors.push('The provided signature has a wrong length.');
	}
	if (errors.length > 0) {
		res.status(422).json({
			status: 'Error',
			errors: errors
		});
		return false;
	}
	return true;
};

const handleEmailRegister = (req, res) => {
	if (req.body.token) {
		if (!emailManager.verifyEmail(req.params.email, base64url.unescape(req.params.token),
			() => res.status(200).json({status: 'OK'}))) {
			res.status(403).json({
				status: 'Error',
				errors: 'invalid Token or mail.'
			});
		}
	} else {
		emailManager.registerEmail(req.body.email);
		res.status(200).json({status: 'OK'});
	}
};

const handleEmailUnregister = (req, res) => {
	emailManager.unregisterEmail(req.body.email, rowCount => {
		if (rowCount == 1) {
			res.status(200).json({status: 'OK'});
		} else if (rowCount == 0) {
			res.status(412).json({
				status: 'Error',
				errors: [`Email "${req.body.email}" does not exist in the database.`]
			});
		}
	});
};

const pushToCopy = (array, object) => {
	const copy = array.slice();
	array.push(object);
	return copy;
};

module.exports = (router) => {
	router.get('/verify/:diceArray/:signature/:date', handleVerify);
	router.post('/roll', registrationMiddleware, handleRoll);
	router.post('/register', handleEmailRegister);
	router.post('/unregister', handleEmailUnregister);
	return router;
};
