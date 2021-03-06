var _ = require('lodash');
var expect = require('chai').expect;
var revman = require('..');
var traverse = require('traverse');

describe('Revman - parse file: antibiotics-for-sore-throat.rm5', function() {
	var data;

	before(function(next) {
		this.timeout(30 * 1000);

		revman.parseFile('./test/data/antibiotics-for-sore-throat.rm5', function(err, res) {
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

	it('should convert objects to arrays where appropriate (single contact)', function() {
		expect(data.coverSheet.contact.person).to.be.an('array');
		expect(data.coverSheet.contact.person).to.have.length(1);
		expect(data.coverSheet.contact.person[0]).to.have.property('id', '18155');
		expect(data.coverSheet.contact.person[0]).to.have.property('firstName', 'Anneliese');
		expect(data.coverSheet.contact.person[0]).to.have.property('lastName', 'Spinks');
		expect(data.coverSheet.contact.person[0]).to.have.property('address');
		expect(data.coverSheet.contact.person[0].address).to.be.an('object');
	});

	it('should convert objects to arrays where appropriate (multiple creators)', function() {
		expect(data.coverSheet.creators.person).to.be.an('array');
		expect(data.coverSheet.creators.person).to.have.length(3);

		expect(data.coverSheet.creators.person[0]).to.have.property('id', '18155');
		expect(data.coverSheet.creators.person[0]).to.have.property('firstName', 'Anneliese');
		expect(data.coverSheet.creators.person[0]).to.have.property('lastName', 'Spinks');
		expect(data.coverSheet.creators.person[0]).to.have.property('address');
		expect(data.coverSheet.creators.person[0].address).to.be.an('object');

		expect(data.coverSheet.creators.person[1]).to.have.property('id', '4655');
		expect(data.coverSheet.creators.person[1]).to.have.property('firstName', 'Paul');
		expect(data.coverSheet.creators.person[1]).to.have.property('lastName', 'Glasziou');
		expect(data.coverSheet.creators.person[1]).to.have.property('address');
		expect(data.coverSheet.creators.person[1].address).to.be.an('object');

		expect(data.coverSheet.creators.person[2]).to.have.property('id', '12249');
		expect(data.coverSheet.creators.person[2]).to.have.property('firstName', 'Chris');
		expect(data.coverSheet.creators.person[2]).to.have.property('lastName', 'Del Mar');
		expect(data.coverSheet.creators.person[2]).to.have.property('address');
		expect(data.coverSheet.creators.person[2].address).to.be.an('object');
	});

	it('should have calculated the outcome structure', function() {
		data.analysesAndData.comparison.forEach(function(comparison) {
			expect(comparison).to.have.property('outcome');
			expect(comparison.outcome).to.be.an('array');
			expect(comparison.outcome).to.have.length.above(0);
			comparison.outcome.forEach(function(outcome) {
				if (outcome.subgroup) {
					expect(outcome.subgroup).to.be.an('array');
					expect(outcome.subgroup).to.have.length.above(0);
					outcome.subgroup.forEach(function(subgroup) {
						expect(subgroup).to.have.property('study');
						expect(subgroup.study).to.be.an('array');
						expect(subgroup.study).to.have.length.above(0);
					});
				} else {
					expect(outcome.study).to.be.an('array');
					expect(outcome.study).to.have.length.above(0);
				}
			});
		});
	});

	it('should have converted scalars into booleans', function() {
		data.analysesAndData.comparison.forEach(function(comparison) {
			comparison.outcome.forEach(function(outcome) {
				['random', 'subgroups', 'subgroupTest', 'swapEvents'].forEach(function(key) {
					expect(outcome).to.have.property(key);
					expect(outcome[key]).to.be.a('boolean');
				});
			});
		});
	});

	it('should have converted scalars into numbers', function() {
		data.analysesAndData.comparison.forEach(function(comparison) {
			comparison.outcome.forEach(function(outcome) {
				['chi2', 'ciEnd', 'tau2'].forEach(function(key) {
					expect(outcome).to.have.property(key);
					expect(outcome[key]).to.be.a('number');
					if (outcome.study) {
						outcome.study.forEach(function(study) {
							expect(study).to.have.property('se');
							expect(study.se).to.be.a('number');
						});
					}
				});
			});
		});
	});

	it('should calculate analysisAndData.comparison[].participants', function() {
		expect(data.analysesAndData.comparison[0].participants).to.equal(20421);
		expect(data.analysesAndData.comparison[0].outcome[0].participants).to.equal(3621);

		expect(data.analysesAndData.comparison[1].participants).to.equal(4102);
		expect(data.analysesAndData.comparison[1].outcome[0].participants).to.equal(1334);
		expect(data.analysesAndData.comparison[1].outcome[3].participants).to.equal(777);

		expect(data.analysesAndData.comparison[2].participants).to.equal(1822);
		expect(data.analysesAndData.comparison[2].outcome[0].participants).to.equal(911);

		expect(data.analysesAndData.comparison[3].participants).to.equal(45864);
		expect(data.analysesAndData.comparison[3].outcome[0].participants).to.equal(10101);
	});

	it('should calculate analysisAndData.comparison[].p + pText', function() {
		expect(data.analysesAndData.comparison[0].outcome[0].p).to.equal(0);
		expect(data.analysesAndData.comparison[0].outcome[0].pText).to.equal('P < 0.00001');

		expect(data.analysesAndData.comparison[0].outcome[4].p).to.equal(0.001406);
		expect(data.analysesAndData.comparison[0].outcome[4].pText).to.equal('P < 0.01');

		expect(data.analysesAndData.comparison[1].outcome[1].p).to.equal(0.121699);
		expect(data.analysesAndData.comparison[1].outcome[1].pText).to.equal('P = 0.121699');
	});

	it('should calculate analysisAndData.comparison[].outcome[].subgroup[].participants', function() {
		expect(data.analysesAndData.comparison[0].outcome[1].subgroup[0].participants).to.equal(1532 + 1130);
		expect(data.analysesAndData.comparison[0].outcome[1].subgroup[1].participants).to.equal(534 + 425);

		expect(data.analysesAndData.comparison[0].outcome[3].subgroup[0].participants).to.equal(1073 + 766);
		expect(data.analysesAndData.comparison[0].outcome[3].subgroup[1].participants).to.equal(458 + 278);
	});

	it('should calculate analysisAndData.comparison[].outcome[].effectMeasureText', function() {
		data.analysesAndData.comparison.forEach(function(comparison) {
			comparison.outcome.forEach(function(outcome) {
				expect(outcome).to.have.property('effectMeasure', 'RR');
				expect(outcome).to.have.property('effectMeasureText', 'Risk Ratio');
			});
		});
	});

	it('should have calculated the summary of findings table', function() {
		expect(data).to.have.property('summaryOfFindings');

		var sof = data.summaryOfFindings;
		expect(sof).to.have.be.an('array');

		sof.forEach(outcome => {
			expect(outcome).to.have.property('outcome');
			expect(outcome.outcome).to.be.a('string');

			expect(outcome).to.have.property('active');
			expect(outcome.active).to.be.a('number');

			expect(outcome).to.have.property('placebo');
			expect(outcome.placebo).to.be.a('number');

			expect(outcome).to.have.property('effect');
			expect(outcome.effect).to.be.a('string');

			expect(outcome).to.have.property('participants');
			expect(outcome.participants).to.be.a('string');

			expect(outcome).to.have.property('quality');
			expect(outcome.quality).to.be.a('string');
		});

		// Random data samples
		expect(sof).to.have.nested.property('0.active', 0.66);
		expect(sof).to.have.nested.property('1.quality', 'High');
		expect(sof).to.have.nested.property('2.comments', 'Based largely on risk in pre-1960 trials');
		expect(sof).to.have.nested.property('3.effect', '0.07 to 1.32');
		expect(sof).to.have.nested.property('4.placebo', 0.14);
		expect(sof).to.have.nested.property('5.participants', '3760 (11)');
	});
});
