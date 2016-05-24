Simple RevMan XML file reader
=============================
Simple module that reads a RevMan XML file and makes it suitable for use in Node.

The following operations are applied to the raw source data:

* XML (buffer or string) translated into JSON object
* All XML keys lower-cased and camelCased
* Initial `cochraneReview` key removed and main body returned as object
* Date fields automatically translated into Date objects
* Various fields automatically translated into arrays
* The `participants` field will automatically be calculated for each comparison and each individual `dichOutcome`
* The `p` field is calculated and rounded using the `pRounding` precision. `pText` is also calculated (e.g. `P < 0.001` etc.)


```javascript
var revman = require('revman');

revman.parseFile('./test/data/antibiotics-for-sore-throat.rm5', function(err, res) {
	// Data should now be a JSON tree object
});
```

See the [antibiotics-for-sore-throat.json](test/data/antibiotics-for-sore-throat.json) file for the JSON output for that sample file and as a rough guide as to the valid Revman fields.


API
===

parse(data, [options], callback)
------------------------------
Parse raw data (data is assumed to be valid XML as a string, stream or buffer) and return the formatted output.

Options can be any of the following:

| Option         | Type           | Default        | Description                                                          |
|----------------|----------------|----------------|----------------------------------------------------------------------|
| `pRounding`    | Number         | `6`            | Decimal place precision when rounding P values                       |
| `arrayFields`  | Array          | *See code*     | An array of fields that should be coerced into an array              |
| `dateFields`   | Array(Strings) | `['modified']` | An array of fields that should be translated into JavaScript dates   |
| `numberFields` | Array(Strings) | *See code*     | An array of fields that should be translated into JavaScript numbers |
| `floatFields`  | Array(Strings) | *See code*     | An array of fields that should be translated into JavaScript floats  |


parseFile(path, [options], callback)
------------------------------------
Convenience function to read a file from disk and return the formatted output.

See the `parse()` function for details on the available options.


Sample data credits
===================
Thanks to Anneliese Spinks, Paul Glasziou, Chris Del Mar for the sample data set [antibiotics-for-sore-throat](test/data/antibiotics-for-sore-throat.rm5) which forms the supplied testing kit.
