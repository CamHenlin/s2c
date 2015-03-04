		casper.waitForSelector(<%= quotedSelector %>,
		   function success() {
		       test.assertExists(<%= quotedSelector %>, '"<%= parsedTarget['value'] %>" must be present.');
		   },
		   function fail() {
		       test.assertExists(<%= quotedSelector %>, '"<%= parsedTarget['value'] %>" must be present.');
		});
		casper.thenEvaluate(function() {
			var elmt = document.querySelector('select[<%= parsedTarget['key'] %>="<%= parsedTarget['value'] %>"]');
	<%	if ( form === 'value' ) { %>
			elmt.value = '<%= parsedValue['value'] %>';
	<%	} else if ( form === 'index' ) { %>
			elmt.selectedIndex = <%= parsedValue['value'] %>;
	<%	} else if ( form === 'id' ) { %>
			var opt = elmt.options.namedItem('<%= parsedTarget['value'] %>');
			opt.selected = true;
	<%	} else { %>
			for ( var i = 0; i < elmt.options.length; i++ ) {
				if ( elmt.options[i].text === '<%= parsedValue['value'] %>') {
					elmt.options[i].selected = true;
				}
			}
	<%	} %>
			if ( elmt.onchange ) { elmt.onchange(); }
		});
