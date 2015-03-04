		casper.wait(<%= updatedTarget %>, function() {
		    this.echo('A wait of <%= updatedTarget %> milliseconds is now complete.');
		});
