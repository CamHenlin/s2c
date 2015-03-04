		casper.waitForSelector(<%= quotedSelector %>,
		   function success() {
		       test.assertExists(<%= quotedSelector %>, '<%= parsedTarget.key %> value "<%= escapedTargetValue %>" must be present.');
		       <%= clickExpression %>;
		     },
		   function fail() {
		       test.assertExists(<%= quotedSelector  %>, '<%= parsedTarget.key %> value "<%= escapedTargetValue %>" must be present.');
		});
