		casper.waitForSelector(<%= selector %>,
			function success() {
				var expectedText = 
					'<%= updatedValue %>';
				test.assertExists(<%= selector %>, '"<%= parsedTarget['value'] %>" must be present.');
				var text = casper.fetchText(<%= selector %>);
				test.assertNotEquals(text, '', 'The "<%= parsedTarget['value'] %>" shouldn\'t be empty');
				test.assertEquals(utils.getTextOnly(text, true), utils.getTextOnly(expectedText, true), 'The "<%= parsedTarget['value'] %>" must be "' + expectedText + '"');
			},
		   function fail() {
		       test.assertExists(<%= selector %>, '"<%= parsedTarget['value'] %>" must be present.');
		}, <%= timeout %>);
