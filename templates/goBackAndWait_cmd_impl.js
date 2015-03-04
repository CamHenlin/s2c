		<%= flagVar %> = false;
		casper.once('load.finished', function setFinished() { <%= flagVar %> = true; });
		casper.back();
		casper.waitFor(
			function check() {
				return <%= flagVar %> === true;
			},
			function then() {
				test.assertTrue(<%= flagVar %>, 'Done waiting for page load going back to previous page.');
			},
			function timeout() {
				test.assertTrue(<%= flagVar %>, 'Done waiting for page load going back to previous page.');
			}
		);
