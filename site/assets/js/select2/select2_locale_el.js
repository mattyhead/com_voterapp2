(function(a){a.extend(a.fn.select2.defaults,{formatNoMatches:function(){return"Δεν βρέθηκαν αποτελέσματα"},formatInputTooShort:function(b,c){var d=c-b.length;return"Παρακαλούμε εισάγετε "+d+" περισσότερους χαρακτήρες"+(d==1?"":"s")},formatInputTooLong:function(c,b){var d=c.length-b;return"Παρακαλούμε διαγράψτε "+d+" χαρακτήρες"+(d==1?"":"s")},formatSelectionTooBig:function(b){return"Μπορείτε να επιλέξετε μόνο "+b+" αντικείμενο"+(b==1?"":"s")},formatLoadMore:function(b){return"Φόρτωση περισσότερων..."},formatSearching:function(){return"Αναζήτηση..."}})})(jQuery);