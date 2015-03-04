		casper.waitForSelector(<%= selector %>,
		   function success() {
		       test.assertExists(<%= selector %>, '<%= assertMsg %>');
		       var val = this.evaluate(function() {
					return document.querySelector('<%= querySelector %>').value;
		       });
		       test.assertEquals(val, '<%= updatedValue %>', 'The value of "<%= quotedSelector %>" must be "<%= updatedValue %>"');
		     },
		   function fail() {
		       test.assertExists(<%= quotedSelector %>, '<%= assertMsg %>');
		});
