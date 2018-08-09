Simple RevMan XML file reader
=============================
Simple module that reads a RevMan XML file and makes it suitable for use in Node.

The following operations are applied to the raw source data:

* XML (buffer or string) translated into JSON object
* All XML keys lower-cased and camelCased
* Initial `cochraneReview` key removed and main body returned as object
* Date fields automatically translated into Date objects
* Various fields automatically translated into arrays
* The `participants` field will automatically be calculated for each comparison each `dichOutcome` and each `dichSubgroup`
* The `p` field is calculated and rounded using the `pRounding` precision. `pText` is also calculated (e.g. `P < 0.001` etc.)
* The `effectMeasureText` value is set to the long-hand version of the shorter `effectMeasure` value (e.g. `effectMeasure=RR` sets `effectMeasureText=Rick Ratio`)
* The `outcome` collection is calculated for each comparison providing easier access to the outcomes and studies without having to look at specific types of study key
* The `outcomeType` key is set for each outcome to label what type of outcome it is
* Summary of Findings tables are reparsed into processable data



```javascript
var revman = require('revman');

revman.parseFile('./test/data/antibiotics-for-sore-throat.rm5', function(err, res, warnings) {
	// Data should now be a JSON tree object
});
```

See the [antibiotics-for-sore-throat.json](test/data/antibiotics-for-sore-throat.json) file for the JSON output for that sample file and as a rough guide as to the valid RevMan fields.


Outcome traversal
-----------------
In order to simplify traversal of a RevMan file an additional meta object, `outcome`, is added to each comparison. The structure of this object is usually of the form: `comparisons[].outcome[].subgroup[].study[]`.

However, since comparisons sometimes do not contain subgroups that portion of the path is optional.

The following trees are example structures using the `outcome` structure:

```
// The first study within an outcome that has subgroups
analysesAndData.comparison[0].outcome[0].subgroup[0].study[0]

// The first study within an outcome with no subgroups
analysesAndData.comparison[0].outcome[0].study[0]
```


Compatibility Notes
===================
This NPM library should translate all the default RevMan data, transforming and fixing most data types (see top of document).

Specific exceptions to data input are listed below.


Summary of Findings
-------------------
The Summary of Findings tables (SoF) is not stored within the RevMan file in a federated way. Unlike most data types the SoF tables are simply a implementation of a (slightly mutated) HTML `<table/>` tag.

For example this is the layout for the header rows of a SoF table from [a test RevMan XML file](test/data/antibiotics-for-sore-throat.rm5):

```html
<SOF_TABLES MODIFIED="2013-10-25 10:47:45 +1000" MODIFIED_BY="[Empty name]">
	<SOF_TABLE ID="SOF-01" MODIFIED="2013-10-25 10:47:45 +1000" MODIFIED_BY="[Empty name]" NO="1">
		<TITLE MODIFIED="2011-05-18 09:42:04 +1000" MODIFIED_BY="Liz Dooley">Summary of findings</TITLE>
		<TABLE COLS="7" ROWS="13">
			<TR>
				<TD COLSPAN="7">
					<P>
						<B>Antibiotics compared with placebo for sore throat</B>
					</P>
				</TD>
			</TR>
			<TR>
				<TD COLSPAN="7">
					<P>
						<B>Patient or population: </B>
						patients presenting with sore throat
					</P>
					<P>
						<B>Settings:</B>
						community
					</P>
					<P>
						<B>Intervention:</B>
						antibiotics
					</P>
					<P>
						<B>Comparison:</B>
						placebo
					</P>
				</TD>
			</TR>
			<TR>
				<TH ROWSPAN="3" VALIGN="BOTTOM">
					<P>Outcomes</P>
				</TH>
				<TH COLSPAN="2" VALIGN="BOTTOM">
					<P>Illustrative comparative risks* (95% CI)</P>
				</TH>
				<TH ROWSPAN="3" VALIGN="BOTTOM">
					<P>Relative effect<BR/>(95% CI)</P>
				</TH>
				<TH ROWSPAN="3" VALIGN="BOTTOM">
					<P>No of participants<BR/>(studies)</P>
				</TH>
				<TH ROWSPAN="3" VALIGN="BOTTOM">
					<P>Quality of the evidence<BR/>(GRADE)</P>
				</TH>
				<TH ROWSPAN="3" VALIGN="BOTTOM">
					<P>Comments</P>
				</TH>
			</TR>
			<TR>
				<TH VALIGN="BOTTOM">
					<P>Assumed risk</P>
				</TH>
				<TH VALIGN="BOTTOM">
					<P>Corresponding risk</P>
				</TH>
			</TR>
			<TR>
				<TH VALIGN="BOTTOM">
					<P>Antibiotics</P>
				</TH>
				<TH VALIGN="BOTTOM">
					<P>Placebo</P>
				</TH>
			</TR>
			<!-- Table truncated for brevity -->
		</TABLE>
	</SOF_TABLE>
</SOF_TABLES>
```

... clearly this data needs to be parsed form HTML data into a data format that is usable.

To manage this, the RevMan NPM file attempts to apply commonly used rules to interpret the data back into a suitable data tree.

The first row of the above data would be parsed as:

```json
{
	summaryOfFindings: [
		{
			outcome: 'Sorer throat: day 3',
			active: 0.66,
			placebo: 0.72,
			effect: '0.68 to 0.76',
			participants: '3621 (15)',
			quality: 'High',
			comments: ''
		}
	]
}
```

See the [antibiotics testkit](test/parse-antibiotics.js) for further examples.




API
===

parse(data, [options], callback)
------------------------------
Parse raw data (data is assumed to be valid XML as a string, stream or buffer) and return the formatted output.

The callback will be called with the pattern `(err, parsedResult, warnings)`. Warnings will be an array of any non-fatal errors encountered when parsing the files (empty subGroups, missing studies etc.)

Options can be any of the following:

| Option                | Type           | Default        | Description                                                                                           |
|-----------------------|----------------|----------------|-------------------------------------------------------------------------------------------------------|
| `pRounding`           | Number         | `6`            | Decimal place precision when rounding P values                                                        |
| `arrayFields`         | Array          | *See code*     | An array of fields that should be coerced into an array                                               |
| `booleanFields`       | Array(Strings) | *See code*     | An array of fields that should be translated into JavaScript booleans                                 |
| `dateFields`          | Array(Strings) | `['modified']` | An array of fields that should be translated into JavaScript dates                                    |
| `numberFields`        | Array(Strings) | *See code*     | An array of fields that should be translated into JavaScript numbers                                  |
| `floatFields`         | Array(Strings) | *See code*     | An array of fields that should be translated into JavaScript floats                                   |
| `effectMeasureLookup` | Object         | *See code*     | Text value of shorthand effect measures (e.g. `effectMeasure=RR` sets `effectMeasureText=Rick Ratio`) |
| `outcomeKeys`         | Array(Objects) | *See code*     | Keys to use when creating the `outcome` structure. Set this to falsy to disable                       |
| `removeEmptyOutcomes` | Boolean        | `true`         | Remove any invalid looking outcomes with no studies or subgroup child nodes                           |
| `debugOutcomes`       | Boolean        | `false`        | Be extra careful reading the comparison structure and warn on any unknown `*Outcome` keys             |
| `formatSofTables`     | Boolean        | `true`         | Process summary of findings tables into processable data                                              |


parseFile(path, [options], callback)
------------------------------------
Convenience function to read a file from disk and return the formatted output.

See the `parse()` function for details on the available options.


Sample data credits
===================
Thanks to Anneliese Spinks, Paul Glasziou, Chris Del Mar for the sample data set [antibiotics-for-sore-throat](test/data/antibiotics-for-sore-throat.rm5) which forms the supplied testing kit.
