var _ = require('lodash');
var async = require('async-chainable');
var fs = require('fs');
var traverse = require('traverse');
var xml2js = require('xml2js');

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
			'otherOutcome', 'otherDta', 'otherSubgroup',

			// Data fields:
			'person', 'whatsNewEntry', 'source', 'qualityItem', 'qualityItemDataEntry', 'comparison', 'feedbackItem', 'figure', 'subsection', 'study', 'reference', 'includedChar', 'excludedChar', 'appendix',

			// Pseudo HTML decorators:
			'p', 'a', 'i', 'b', 'link', 'ol', 'li', 'br', 'sup', 'tr', 'td', 'th',
			'additionalTable', 'extension', 'flowchartbox',
		],
		ignoreFields: ['sup'],
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
			{type: 'other', outcome: 'otherOutcome', study: 'otherData', subgroup: 'otherSubgroup'},
		],
		removeEmptyOutcomes: true,
		debugOutcomes: false,
		formatSofTables: true,
	});
	// }}}

	async()
		// Read in file contents {{{
		.then('json', function(next) {
			xml2js.parseString(data, {
				explicitArray: false,
				trim: true,
				normalize: true,
				mergeAttrs: true,
				tagNameProcessors: [ tag => _.camelCase(tag) ],
				attrNameProcessors: [ tag => _.camelCase(tag) ],
			}, next);
		})
		// }}}
		// Unwrap the first object found {{{
		.then('json', function(next) {
			if (!_.has(this.json, 'cochraneReview')) return next('This does not look like a valid RevMan file');
			// Object.assign(this.json.coc
			next(null, Object.assign({}, this.json.cochraneReview, this.json.$));
		})
		// }}}
		// Parse raw input into JS standard JSON {{{
		.then('json', function(next) {
			next(null, traverse(this.json).map(function(v) {
				if (_.includes(settings.arrayFields, this.key)) { // Translate value into array
					if (_.isObject(v) && _.has(v, '0')) { // Multiple items in array
						this.update(_.values(v));
					} else { // Single item array
						this.update([v]);
					}
				} else if (_.isObject(v)) { // Normalize keys
					// Pass
				} else if (_.includes(settings.dateFields, this.key)) { // Translate value into Date
					this.update(new Date(v));
				} else if (_.includes(settings.numberFields, this.key)) { // Translate into numbers
					this.update(parseInt(v));
				} else if (_.includes(settings.floatFields, this.key)) { // Translate into floats
					this.update(parseFloat(v));
				} else if (_.includes(settings.booleanFields, this.key)) { // Translate into floats
					this.update(v == 'YES');
				}
			}));
		})
		// }}}
		// Calculate comparison.outcome {{{
		.then(function(next) {
			if (!settings.outcomeKeys) return next();
			if (!this.json.analysesAndData) this.json.analysesAndData = {} // Force this section to exist even if it is blank

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

					// Re-sort the comparison outcomes so they are in the right order {{{
					if (comparison && _.isObject(comparison) && _.isArray(comparison.outcome))
						comparison.outcome = _.sortBy(comparison.outcome, 'no');
					// }}}

					// Output warnings for any unknown `*Outcome` keys {{{
					if (settings.debugOutcomes && _.isObject(comparison)) {
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
		})
		// }}}
		.parallel([
			// Calculate study.participants {{{
			function(next) {
				if (!_.isArray(this.json.analysesAndData.comparison)) return next();
				this.json.analysesAndData.comparison.forEach(function(comparison) {
					comparison.participants = 0;
					if (comparison.outcome && _.isArray(comparison.outcome))
						comparison.outcome.forEach(function(outcome) {
							outcome.total1 = parseInt(outcome.total1);
							outcome.total2 = parseInt(outcome.total2);
							outcome.participants = outcome.total1 + outcome.total2;
							comparison.participants += outcome.participants;

							if (outcome.subgroup && _.isArray(outcome.subgroup)) {
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
					if (comparison.outcome && _.isArray(comparison.outcome))
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
					if (comparison.outcome && _.isArray(comparison.outcome))
						['outcome', 'dichOutcome'].forEach(e => {
							if (!_.has(comparison, e)) return;
							comparison[e].forEach(function(outcome) {
								if (_.has(outcome, 'effectMeasure')) outcome.effectMeasureText = settings.effectMeasureLookup[outcome.effectMeasure] || outcome.effectMeasure;
							});
						});
				});
				next();
			},
			// }}}
			// Calculate sofTables {{{
			function(next) {
				if (!settings.formatSofTables) return next();
				if (!_.has(this.json, 'sofTables.sofTable.table')) return next();

				this.json.summaryOfFindings = this.json.sofTables.sofTable.table.tr
					.filter(tr => !_.has(tr, 'td.0.colspan') && _.has(tr, 'td.0.p.0')) // Filter all except individual cells
					.map(tr => ({
						outcome: revman.util.flatten(_.get(tr, 'td.0.p.0'), settings),
						active: parseFloat(revman.util.flatten(_.get(tr, 'td.1.p.0'), settings)),
						placebo: parseFloat(revman.util.flatten(_.get(tr, 'td.2.p.0'), settings)),
						relativeEffect: revman.util.flatten(_.get(tr, 'td.3.p.0'), settings),
						participants: revman.util.flatten(_.get(tr, 'td.4.p.0'), settings),
						qualityOfEvidence: revman.util.flatten(_.get(tr, 'td.5.p.0'), settings),
					}));

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


/**
* General storage for Utilify functions
* @var {Object}
*/
revman.util = {};


/**
* Utility function to flatten an object down to its atomic value
* This is used by the summaryOfFindings parcer to collapse structures such as tr.td.0.p.0 into a string value
* @param {*} item Item to flatten
* @param {Object} [options] Optional settings to include
* @param {array} [options.ignoreFields=[]] Array of fields to ignore when flattening (usually HTML tags)
* @returns {*} The nearest value to possible to an atomic scalar
*/
revman.util.flatten = (item, options) => {
	var settings = _.defaults(options, {
		ignoreFields: [],
	});

	return (
		traverse(item).reduce(function(acc, x) {
			if (settings.ignoreFields.includes(this.key)) return this.remove(true);
			if (this.isLeaf && x) acc.push(x);
			return acc;
		}, [])
		|| []
	).join(', ');
};
