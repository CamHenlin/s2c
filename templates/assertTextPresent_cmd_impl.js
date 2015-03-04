<%
// 'assertTextPresent' is deprecated in favor of assertText, but it is still used widely.
// It maps easily to the casperJS assertTextExists() method.
//
// The statement above is still true, and  the mapping to assertTextExists works well for
// short pieces of text such as this:
// 		casper.then(function() {
// 			test.assertTextExists('A short message', 'The text "A short message" must be present.');
// 		});
// but there are no guarantees.  In Selenium IDE, the string to be
// searched for has been trimmed of multiple embedded whitepace characters.  CasperJS doesn't have
// an assertTrimmedTextExists which would search the DOM for text and trim values before doing
// the compare so we have to do it the hard way:  manually.  Below is what I've come up with.
%>
		casper.then(function() {
			var allText = this.evaluate(function() {
				var items = document.body.getElementsByTagName("*");
				var textContents = [];
				for (var i = items.length; i--;) {
					textContents.push(items[i].textContent);
				}
				return textContents;
			});
			var found = false;
			allText.every(function(element, index, array) {
				if ( utils.getTextOnly(element, true).indexOf('<%= updatedTarget %>') >= 0 ) {
					found = true;
					return false;
				}
				return true;
			});
			test.assertTrue(found, 'The text "<%= updatedTarget %>" must be present.');
		});
