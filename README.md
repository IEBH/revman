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


API
===

parse(data, [options], callback)
------------------------------
Parse raw data (data is assumed to be valid XML as a string, stream or buffer) and return the formatted output.

The callback will be called with the pattern `(err, parsedResult, warnings)`. Warnings will be an array of any non-fatal errors encounted when parsing the files (empty subGroups, missing studies etc.)

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


parseFile(path, [options], callback)
------------------------------------
Convenience function to read a file from disk and return the formatted output.

See the `parse()` function for details on the available options.


Sample data credits
===================
Thanks to Anneliese Spinks, Paul Glasziou, Chris Del Mar for the sample data set [antibiotics-for-sore-throat](test/data/antibiotics-for-sore-throat.rm5) which forms the supplied testing kit.
