		casper.waitForSelector(<%= quotedSelector %>,
		   function success() {
		       test.assertExists(<%= quotedSelector %>, 'The <%= parsedTarget['key'] %> value "<%= parsedTarget['value'] %>" must be present.');
		   },
		   function fail() {
		       test.assertExists(<%= quotedSelector %>, 'The <%= parsedTarget['key'] %> value "<%= parsedTarget['value'] %>" must be present.');
		});
		<%= flagVar %> = false;
		casper.once('load.finished', function setFinished() { <%= flagVar %> = true; });
		casper.thenEvaluate(function() {
			var elmt = document.querySelector('<%= querySelector %>');
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
			if ( elmt.onchange ) {
				elmt.onchange();
			} else {
				$('<%= querySelector %>').trigger('change');
			}
	<%	} %>
		});
		casper.waitFor(
			function check() {
				return <%= flagVar %> === true;
			},
			function then() {
				test.assertTrue(<%= flagVar %>, 'Done waiting for page load after clicking on <%= parsedTarget['key'] %> "<%= parsedTarget['value'] %>"');
			}
		);

