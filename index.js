var _ = require('lodash');
var async = require('async-chainable');
var fs = require('fs');
var traverse = require('traverse');
var xml2json = require('xml2json');

var revman = {};
module.exports = revman;

revman.parse = function parse(data, options, callback) {
	// Deal with incomming arguments {{{
	if (_.isFunction(options)) { // Called via data, callback
		callback = options;
		options = {};
	} else if (!_.isFunction(callback)) {
		throw new Error('No callback specified');
	}
	// }}}

	// Process settings {{{
	var settings = _.defaults(options, {
		pRounding: 6,
		dateFields: ['modified'],
		floatFields: ['ciEnd', 'ciStart', 'effectSize', 'logCiEnd', 'logCiStart', 'logEffectSize', 'se', 'var', 'weight', 'i2', 'i2Q', 'q', 'scale', 'chi2', 'pChi2', 'pQ', 'pZ', 'tau2', 'z', 'oE'],
		numberFields:  ['events1', 'events2', 'order', 'no', 'studies', 'total1', 'total2', 'ciStudy', 'ciTotal', 'df'],
		booleanFields: ['estimable', 'random', 'subgroups', 'subgroupTest', 'swapEvents', 'totals'],
		arrayFields: [
			// Data fields:
			'person', 'whatsNewEntry', 'source', 'qualityItem', 'qualityItemDataEntry', 'comparison', 'feedbackItem', 'figure', 'subsection', 'study', 'reference', 'includedChar', 'excludedChar', 'contData', 'contOutcome', 'contSubgroup', 'dichOutcome', 'dichData', 'dichSubgroup', 'dichOutcome', 'ivData', 'appendix',

			// Pseudo HTML decorators:
			'p', 'a', 'i', 'b', 'link', 'ol', 'li', 'br', 'sup', 'tr', 'td', 'th',
			'additionalTable', 'extension', 'flowchartbox',
		],
		effectMeasureLookup: {
			'RR': 'Risk Ratio',
			'ARR': 'Absolute Risk Reduction',
			'CGR': 'Control Group Risk',
			'CCT': 'Controlled Clinical Trial',
			'IV': 'Inverse Variance',
			'M-H': 'Mantel-Haenszel',
			'MD': 'Mean Difference',
			'OR': 'Odds Ratio',
			'RD': 'Risk Difference',
			'SD': 'Standard Deviation',
			'SE': 'Standard Error',
			'SMD': 'Standardized Mean Difference',
		},
		outcomeKeys: [
			{type: 'dich', outcome: 'dichOutcome', study: 'dichData', subgroup: 'dichSubgroup'},
			{type: 'cont', outcome: 'contOutcome', study: 'contData', subgroup: 'contSubgroup'},
		],
	});
	// }}}

	async()
		// Read in file contents {{{
		.then('json', function(next) {
			try {
				var rmXML = xml2json.toJson(data, {
					object: true,
				});
				next(null, rmXML);
			} catch (e) {
				next(e);
			}
		})
		// }}}
		// Parse raw input into JS standard JSON {{{
		.then('json', function(next) {
			next(null, traverse(this.json).map(function(v) {
				if (_.includes(settings.arrayFields, this.key)) { // Translatevalue into array
					if (_.isObject(v) && _.has(v, '0')) { // Multiple items in array
						this.update(_.values(v));
					} else { // Single item array
						this.update([v]);
					}
				} else if (_.isObject(v)) { // Normalize keys
					this.update(_.mapKeys(v, function(c, k) {
						return _.camelCase(k.toLowerCase());
					}));
				} else if (_.includes(settings.dateFields, this.key)) { // Translate value into Date
					this.update(new Date(v));
				} else if (_.includes(settings.numberFields, this.key)) { // Translate into numbers
					this.update(parseInt(v));
				} else if (_.includes(settings.floatFields, this.key)) { // Translate into floats
					this.update(parseFloat(v));
				} else if (_.includes(settings.booleanFields, this.key)) { // Translate into floats
					this.update(v == 'YES');
				}
			}).cochraneReview);
		})
		// }}}
		.parallel([
			// Calculate comparison.outcome {{{
			function(next) {
				if (!settings.outcomeKeys) return next();
				this.json.analysesAndData.comparison.forEach(function(comparison, comparisonIndex) {
					_.some(settings.outcomeKeys, function(outcomeMeta) {
						if (_.has(comparison, outcomeMeta.outcome)) {
							comparison.outcomeType = outcomeMeta.type;
							comparison.outcome = comparison[outcomeMeta.outcome];
							comparison.outcome.forEach(function(outcome, outcomeIndex) {
								if (_.has(outcome, outcomeMeta.subgroup)) { // This outcome has subgroups
									outcome.subgroup = outcome[outcomeMeta.subgroup];
									outcome.subgroup.forEach(function(subgroup, subgroupIndex) {
										subgroup.study = subgroup[outcomeMeta.study];
									});
								} else if (_.has(outcome, outcomeMeta.study)) { // This outcome has no subgroups and just contains studies
									outcome.study = outcome[outcomeMeta.study];
								} else {
									throw new Error('Cannot determine outcome at: ' + ['comparison', comparisonIndex, 'outcome', outcomeIndex].join('.'));
								}
							});
							return true;
						}
					});
				});
				next();
			},
			// }}}
			// Calculate study.participants {{{
			function(next) {
				this.json.analysesAndData.comparison.forEach(function(comparison) {
					comparison.participants = 0;
					comparison.dichOutcome.forEach(function(outcome) {
						outcome.total1 = parseInt(outcome.total1);
						outcome.total2 = parseInt(outcome.total2);
						outcome.participants = outcome.total1 + outcome.total2;
						comparison.participants += outcome.participants;

						if (outcome.dichSubgroup) {
							outcome.dichSubgroup.forEach(function(subgroup) {
								subgroup.participants = subgroup.total1 + subgroup.total2;
							});
						}
					});
				});
				next();
			},
			// }}}
			// Calculate study.pText {{{
			function(next) {
				this.json.analysesAndData.comparison.forEach(function(comparison) {
					comparison.dichOutcome.forEach(function(outcome) {
						outcome.pZ = parseFloat(outcome.pZ);
						var p = outcome.p = _.round(outcome.pZ, settings.pRounding);
						outcome.pText = 
							p <= 0.00001 ? 'P < 0.00001' :
							p <= 0.0001 ? 'P < 0.0001' :
							p <= 0.001 ? 'P < 0.001' :
							p <= 0.01 ? 'P < 0.01' :
							p <= 0.05 ? 'P < 0.05' :
							'P = ' + p;
					});
				});
				next();
			},
			// }}}
			// Calculate study.effectMeasureText {{{
			function(next) {
				this.json.analysesAndData.comparison.forEach(function(comparison) {
					comparison.dichOutcome.forEach(function(outcome) {
						if (_.has(outcome, 'effectMeasure')) outcome.effectMeasureText = settings.effectMeasureLookup[outcome.effectMeasure];
					});
				});
				next();
			},
			// }}}
		])
		// End {{{
		.end(function(err) {
			callback(err, this.json);
		});
		// }}}
}

revman.parseFile = function parseFile(path, options, callback) {
	// Deal with incomming arguments {{{
	if (_.isFunction(options)) { // Called via data, callback
		callback = options;
		options = {};
	} else if (!_.isFunction(callback)) {
		throw new Error('No callback specified');
	}
	// }}}

	async()
		.then('contents', function(next) {
			fs.readFile(path, 'utf-8', next);
		})
		.end(function(err) {
			if (err) return callback(err);
			revman.parse(this.contents, options, callback);
		});
}
