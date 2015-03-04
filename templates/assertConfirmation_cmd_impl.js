		expectedConfirmMessage = "<%= updatedTarget %>";
		casper.waitFor(function check() {
		    	return confirmMessageReceived;
		    },
		    function success() {
			    test.assertEquals(confirmMessage,
			    	expectedConfirmMessage,
			    	'Confirm message must be "' + expectedConfirmMessage + '"');
				// Now that we're done with assertConfirmation variables, reset them in preparation for next usage.
				confirmMessage = '';
				confirmMessageReceived = false;
			}, 
			function fail() {
			    test.assertEquals(confirmMessage,
			    	expectedConfirmMessage,
			    	'Confirm message must be "' + expectedConfirmMessage + '"');
				// Now that we're done with assertConfirmation variables, reset them in preparation for next usage.
				confirmMessage = '';
				confirmMessageReceived = false;
		}, <%= timeout %>);
