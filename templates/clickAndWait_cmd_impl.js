		<%= flagVar %> = false;
		casper.once('load.finished', function setFinished() { <%= flagVar %> = true; });
		casper.then(function() {
			<%= clickExpression %>;
		});
		casper.waitFor(
			function check() {
				return <%= flagVar %> === true;
			},
			function then() {
				test.assertTrue(<%= flagVar %>, 'Done waiting for page load after clicking on <%= parsedTarget['key'] %> "<%= parsedTarget['value'] %>"');
			}
		);
