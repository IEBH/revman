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
		path: undefined,
		dateFields: ['modified'],
		arrayFields: [
			// Data fields:
			'person', 'whatsNewEntry', 'source', 'qualityItem', 'qualityItemDataEntry', 'comparison', 'feedbackItem', 'figure', 'subsection', 'study', 'reference', 'includedChar', 'excludedChar', 'dichOutcome', 'dichData', 'dichSubgroup', 'dichOutcome', 'appendix',

			// Pseudo HTML decorators:
			'p', 'i', 'b', 'link', 'ol', 'li', 'br', 'sup', 'tr', 'td', 'th',
		],
	});
	// }}}

	async()
		// Read in file contents {{{
		.then('json', function(next) {
			var rmXML = xml2json.toJson(data, {
				object: true,
			});
			next(null, rmXML);
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
				}
			}).cochraneReview);
		})
		// }}}
		.parallel([
			// calculate study.participants {{{
			function(next) {
				this.json.analysesAndData.comparison.forEach(function(comparison) {
					comparison.participants = 0;
					comparison.dichOutcome.forEach(function(outcome) {
						outcome.total1 = parseInt(outcome.total1);
						outcome.total2 = parseInt(outcome.total2);
						outcome.participants = outcome.total1 + outcome.total2;
						comparison.participants += outcome.participants;
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
