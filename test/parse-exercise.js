var _ = require('lodash');
var expect = require('chai').expect;
var revman = require('..');
var traverse = require('traverse');

describe('Revman - parse file: exercise-acute-respiratory-infections.rm5', function() {
	var data;

	before(function(next) {
		this.timeout(30 * 1000);

		revman.parseFile('./test/data/exercise-acute-respiratory-infections.rm5', function(err, res) {
			expect(err).to.be.not.ok;
			data = res;
			next();
		});
	});

	it('should parse the file', function() {
		expect(data).to.be.an('object');

	});

	it('should contain all the standard Revman file keys', function() {
		['description', 'doi', 'groupId', 'id', 'mergedFrom', 'modified', 'modifiedBy', 'reviewNo', 'revmanSubVersion', 'revmanVersion', 'splitFrom', 'stage', 'status', 'type', 'versionNo', 'coverSheet', 'mainText', 'studiesAndReferences', 'characteristicsOfStudies', 'qualityItems', 'sofTables', 'additionalTables', 'analysesAndData', 'figures', 'feedback', 'appendices', 'extensions'].forEach(function(k) {
			expect(data).to.have.property(k);
		});
	});

	it('should have converted scalars into booleans', function() {
		[
			'analysesAndData.comparison.0.dichOutcome.0.random',
			'analysesAndData.comparison.0.dichOutcome.0.subgroups',
			'analysesAndData.comparison.0.dichOutcome.0.swapEvents',
		].forEach(function(path) {
			var val = _.get(data, path);
			expect(val).to.be.a('boolean');
		});
	});

	it('should have converted scalars into numbers', function() {
		[
			'analysesAndData.comparison.0.dichOutcome.0.chi2',
			'analysesAndData.comparison.0.dichOutcome.0.ciEnd',
			'analysesAndData.comparison.0.dichOutcome.0.tau2',
			'analysesAndData.comparison.0.dichOutcome.0.dichData.0.se',
		].forEach(function(path) {
			var val = _.get(data, path);
			expect(val).to.be.ok;
			expect(val).to.be.a('number');
		});
	});

	it('should calculate analysisAndData.comparison[].dichOutcome[].effectMeasureText', function() {
		data.analysesAndData.comparison.forEach(function(comparison) {
			comparison.dichOutcome.forEach(function(outcome) {
				expect(outcome).to.have.property('effectMeasure', 'RR');
				expect(outcome).to.have.property('effectMeasureText');
			});
		});
	});
});
