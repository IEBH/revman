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
		expect(data).to.be.an.object;

	});

	it('should contain all the standard Revman file keys', function() {
		['description', 'doi', 'groupId', 'id', 'mergedFrom', 'modified', 'modifiedBy', 'reviewNo', 'revmanSubVersion', 'revmanVersion', 'splitFrom', 'stage', 'status', 'type', 'versionNo', 'coverSheet', 'mainText', 'studiesAndReferences', 'characteristicsOfStudies', 'qualityItems', 'sofTables', 'additionalTables', 'analysesAndData', 'figures', 'feedback', 'appendices', 'extensions'].forEach(function(k) {
			expect(data).to.have.property(k);
		});
	});

	it('should convert objects to arrays where appropriate (single contact)', function() {
		expect(data.coverSheet.contact.person).to.be.a.array;
		expect(data.coverSheet.contact.person).to.have.length(1);
		expect(data.coverSheet.contact.person[0]).to.have.property('id', '18155');
		expect(data.coverSheet.contact.person[0]).to.have.property('firstName', 'Anneliese');
		expect(data.coverSheet.contact.person[0]).to.have.property('lastName', 'Spinks');
		expect(data.coverSheet.contact.person[0]).to.have.property('address');
		expect(data.coverSheet.contact.person[0].address).to.be.an.object;
	});

	it('should convert objects to arrays where appropriate (multiple creators)', function() {
		expect(data.coverSheet.creators.person).to.be.a.array;
		expect(data.coverSheet.creators.person).to.have.length(3);

		expect(data.coverSheet.creators.person[0]).to.have.property('id', '18155');
		expect(data.coverSheet.creators.person[0]).to.have.property('firstName', 'Anneliese');
		expect(data.coverSheet.creators.person[0]).to.have.property('lastName', 'Spinks');
		expect(data.coverSheet.creators.person[0]).to.have.property('address');
		expect(data.coverSheet.creators.person[0].address).to.be.an.object;

		expect(data.coverSheet.creators.person[1]).to.have.property('id', '4655');
		expect(data.coverSheet.creators.person[1]).to.have.property('firstName', 'Paul');
		expect(data.coverSheet.creators.person[1]).to.have.property('lastName', 'Glasziou');
		expect(data.coverSheet.creators.person[1]).to.have.property('address');
		expect(data.coverSheet.creators.person[1].address).to.be.an.object;

		expect(data.coverSheet.creators.person[2]).to.have.property('id', '12249');
		expect(data.coverSheet.creators.person[2]).to.have.property('firstName', 'Chris');
		expect(data.coverSheet.creators.person[2]).to.have.property('lastName', 'Del Mar');
		expect(data.coverSheet.creators.person[2]).to.have.property('address');
		expect(data.coverSheet.creators.person[2].address).to.be.an.object;
	});

	it('should not have any orphaned objects that should be arrays', function() {
		// This test checks that all objects have been correctly converted to an array
		// Its a bit ugly because of the weird determination JavaScript places on the differences between {0: 'foo'} and ['foo']
		traverse(data).forEach(function(v) {
			if (!_.isArray(v) && _.isObject(v) && this.key === '0') {
				var node = _.get(data, this.path.slice(0, -1));
				expect(node).to.be.an.array;
				expect(node).to.not.have.key(0);
				expect(_.isPlainObject(node)).to.be.not.ok;
				expect(node).to.not.equal('0', '"0" key found at ' + this.path.join('.'));
			}
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
			expect(val).to.be.a.number;
		});
	});

	it('should calculate analysisAndData.comparison[].participants', function() {
		expect(data.analysesAndData.comparison[0].participants).to.equal(20421);
		expect(data.analysesAndData.comparison[0].dichOutcome[0].participants).to.equal(3621);

		expect(data.analysesAndData.comparison[1].participants).to.equal(4102);
		expect(data.analysesAndData.comparison[1].dichOutcome[0].participants).to.equal(1334);
		expect(data.analysesAndData.comparison[1].dichOutcome[3].participants).to.equal(777);

		expect(data.analysesAndData.comparison[2].participants).to.equal(1822);
		expect(data.analysesAndData.comparison[2].dichOutcome[0].participants).to.equal(911);

		expect(data.analysesAndData.comparison[3].participants).to.equal(45864);
		expect(data.analysesAndData.comparison[3].dichOutcome[0].participants).to.equal(10101);
	});

	it('should calculate analysisAndData.comparison[].p + pText', function() {
		expect(data.analysesAndData.comparison[0].dichOutcome[0].p).to.equal(0);
		expect(data.analysesAndData.comparison[0].dichOutcome[0].pText).to.equal('P < 0.00001');

		expect(data.analysesAndData.comparison[0].dichOutcome[4].p).to.equal(0.001406);
		expect(data.analysesAndData.comparison[0].dichOutcome[4].pText).to.equal('P < 0.01');

		expect(data.analysesAndData.comparison[1].dichOutcome[1].p).to.equal(0.121699);
		expect(data.analysesAndData.comparison[1].dichOutcome[1].pText).to.equal('P = 0.121699');
	});
});
