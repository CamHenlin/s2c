		casper.waitForSelector(<%= quotedSelector %>,
			function success() {
				var expectedText = 
					'<%= parsedValue['value'] %>';
				test.assertExists(<%= quotedSelector %>, '<%= assertMsg %>');
				<%
				// in some cases we use querySelector (instead of fetchText) because if the selector matches more than one node,
				// fetchText will return the concatenated textContent for all the matching nodes. querySelector, on the other 
				// hand, will always return the first node.
				%>
		<%	if ( useQuerySelector ) { %>
				var text = casper.evaluate(function() {
						return document.querySelector(<%= quotedSelector %>).textContent;
				});
		<%	} else { %>
				var text = casper.fetchText(<%= quotedSelector %>);
		<%	} %>
				test.assertNotEquals(text, '', 'The "<%= parsedTarget['value'] %>" shouldn\'t be empty');
				test.assertEquals(utils.getTextOnly(text, true), utils.getTextOnly(expectedText, true), 'The "<%= parsedTarget['value'] %>" must be "' + expectedText + '"');
			},
		   function fail() {
		       test.assertExists(<%= quotedSelector %>, '<%= assertMsg %>');
		}, <%= timeout %>);
