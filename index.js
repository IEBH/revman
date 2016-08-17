var _ = require('lodash');
var async = require('async-chainable');
var fs = require('fs');
var traverse = require('traverse');
var xml2json = require('xml2json');

var revman = {};
module.exports = revman;

revman.parse = function parse(data, options, callback) {
	var warnings = [];

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
			// Outcome fields:
			'contOutcome', 'contData', 'contSubgroup',
			'dichOutcome', 'dichData', 'dichSubgroup', 'dichOutcome', 
			'ivOutcome', 'ivData', 'ivSubgroup',

			// Data fields:
			'person', 'whatsNewEntry', 'source', 'qualityItem', 'qualityItemDataEntry', 'comparison', 'feedbackItem', 'figure', 'subsection', 'study', 'reference', 'includedChar', 'excludedChar', 'appendix',

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
			{type: 'iv', outcome: 'ivOutcome', study: 'ivData', subgroup: 'ivSubgroup'},
		],
		removeEmptyOutcomes: true,
		debugOutcomes: false,
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
				if (_.isArray(this.json.analysesAndData.comparison)) {
					this.json.analysesAndData.comparison.forEach(function(comparison, comparisonIndex) {
						comparison.outcome = [];
						settings.outcomeKeys.forEach(function(outcomeMeta) {
							if (_.has(comparison, outcomeMeta.outcome)) {
								if (_.isArray(comparison[outcomeMeta.outcome])) {
									comparison[outcomeMeta.outcome].forEach(function(outcome, outcomeIndex) {
										outcome.outcomeType = outcomeMeta.type;

										if (_.has(outcome, outcomeMeta.subgroup)) { // This outcome has subgroups
											if (_.isArray(outcome[outcomeMeta.subgroup])) {
												outcome.subgroup = outcome[outcomeMeta.subgroup];
												outcome.subgroup.forEach(function(subgroup, subgroupIndex) {
													subgroup.study = subgroup[outcomeMeta.study];
												});
											} else {
												warnings.push('Expected structure at "comparison[' + comparisonIndex + '].' + outcomeMeta.outcome + '[' + outcomeIndex + '].subgroup" to be an array but got ' + (typeof outcome[outcomeMeta.subgroup]));
												console.log(outcome[outcomeMeta.subgroup]);
											}
										} else if (_.has(outcome, outcomeMeta.study)) { // This outcome has no subgroups and just contains studies
											if (_.isArray(outcome[outcomeMeta.study])) {
												outcome.study = outcome[outcomeMeta.study];
											} else {
												warnings.push('Expected structure at "comparison[' + comparisonIndex + '].' + outcomeMeta.study + '" to be an array but got ' + (typeof outcome[outcomeMeta.study]));
											}
										} else {
											warnings.push('Outcome at "comparison[' + comparisonIndex + '].outcome[' + (outcome.no-1) + ']" contains no subgroups or studies');
										}

										comparison.outcome.push(outcome);
									});
								} else {
									warnings.push('Expected structure at "comparison[' + comparisonIndex + '].' + outcomeMeta.outcome + '" to be an array but got ' + (typeof comparison[outcomeMeta.outcome]));
								}
							}
						});

						// Resort the comparison outcomes so they are in the right order {{{
						comparison.outcome = _.sortBy(comparison.outcome, 'no');
						// }}}

						// Output warnings for any unknown `*Outcome` keys {{{
						if (settings.debugOutcomes) {
						_.keys(comparison)
							.filter(function(key) {
								// Ends with 'Outcome'...
								return (/Outcome$/.test(key));
							})
							.filter(function(key) {
								// AND is not already recognised
								return !_.includes(_.map(settings.outcomeKeys, 'outcome'), key);
							})
							.forEach(function(key) {
								warnings.push('Unrecognised Outcome key "' + key + '"');
							});
						}
						// }}}

						// Remove empty otucomes if (settings.removeEmptyOutcomes) {{{
						if (settings.removeEmptyOutcomes) {
							comparison.outcome = comparison.outcome.filter(function(outcome) {
								return (outcome.subgroup || outcome.study);
							});
						}
						// }}}
					});
				} else {
					warnings.push('Expected structure at "comparison" to be an array but got ' + (typeof this.json.analysesAndData.comparison));
				}
				next();
			},
			// }}}
			// Calculate study.participants {{{
			function(next) {
				if (!_.isArray(this.json.analysesAndData.comparison)) return next();
				this.json.analysesAndData.comparison.forEach(function(comparison) {
					comparison.participants = 0;
					comparison.outcome.forEach(function(outcome) {
						outcome.total1 = parseInt(outcome.total1);
						outcome.total2 = parseInt(outcome.total2);
						outcome.participants = outcome.total1 + outcome.total2;
						comparison.participants += outcome.participants;

						if (outcome.subgroup) {
							outcome.subgroup.forEach(function(subgroup) {
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
				if (!_.isArray(this.json.analysesAndData.comparison)) return next();
				this.json.analysesAndData.comparison.forEach(function(comparison) {
					comparison.outcome.forEach(function(outcome) {
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
				if (!_.isArray(this.json.analysesAndData.comparison)) return next();
				this.json.analysesAndData.comparison.forEach(function(comparison) {
					comparison.outcome.forEach(function(outcome) {
						if (_.has(outcome, 'effectMeasure')) outcome.effectMeasureText = settings.effectMeasureLookup[outcome.effectMeasure];
					});
				});
				next();
			},
			// }}}
		])
		// End {{{
		.end(function(err) {
			callback(err, this.json, warnings);
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
