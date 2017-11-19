'use strict';
const roller = require('./dice-roller');
const validator = require('./validator');
const base64url = require('base64-url');

module.exports = function(router){
	router.get('/verify/:diceArray/:signature/:date', transformParams({'signature': base64url.unescape}), handleVerify);
	router.get('/roll/:max/:times/:email1/:email2', transformParams({'max': parseInt, 'times': parseInt}), handleRoll);
	router.post('/roll', isUserRegistered, handleRoll);
	return router;
};

function isUserRegistered(req, res, next){
	next();
}

function transformParams(actionmap){
	return function(req, res, next){
		for(const key in actionmap){
			req.params[key] = actionmap[key](req.params[key]);
		}
		next();
	};
}

function handleRoll(req, res){
	if(validateRollArgs(req, res)){
		const dice = roller.roll(req.params.max, req.params.times);
		const now = new Date();
		validator.sign(pushToCopy(dice, now.getTime()), signature => res.json({
			status: 'OK',
			result: {
				dice: dice,
				signature: {
					plain: signature,
					urlescaped: base64url.escape(signature)
				},
				date: now.toISOString()
			}
		}));
	}
}

function validateRollArgs(req, res){
	const errors = [];
	function validateIntParam(name){
		if(!req.params[name]){
			errors.push(name + ' parameter is not defined');
		} else if(!Number.isInteger(req.params[name])){
			errors.push(name + ' parameter is not a valid number');
		}
	}
	validateIntParam('max');
	validateIntParam('times');
	if(errors.length > 0){
		res.status(422).json({
			status: 'Error',
			errors: errors
		});
		return false;
	}
	return true;
}

function handleVerify(req, res){
	if(!validateVerifyArgs(req, res)){
		return;
	}
	const queryDate = new Date(req.params.date);
	req.params.diceArray.push(queryDate.getTime());
	validator.verify(req.params.diceArray, req.params.signature, queryDate, valid => res.json({
		status: 'OK',
		valid: valid
	}), e => res.status(410).json({
		status: 'Error',
		errors: [e]
	}));
}

function validateVerifyArgs(req, res){
	const errors = [];
	if(typeof req.params.diceArray === 'string'){
		try {
			req.params.diceArray = JSON.parse(req.params.diceArray);
		} catch(e){
			if(!(e instanceof SyntaxError)){
				throw e;
			} else {
				errors.push('The supplied diceArray parameter is invalid JSON');
			}
		}
	}
	if(errors.length === 0){
		if(Array.isArray(req.params.diceArray)){
			req.params.diceArray = req.params.diceArray.map(o => parseInt(o));
			if(req.params.diceArray.some(Number.isNaN)){
				errors.push('The provided diceArray parameter contains values other than integers');
			}
		} else{
			errors.push('The provided diceArray parameter is not an array');
		}
	}
	if(req.params.signature.length !== 684){
		errors.push('The provided signature has a wrong length');
	}
	if(errors.length > 0){
		res.status(422).json({
			status: 'Error',
			errors: errors
		});
		return false;
	}
	return true;
}

function pushToCopy(array, object){
	const copy = array.slice();
	array.push(object);
	return copy;
}
