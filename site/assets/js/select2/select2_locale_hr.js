(function(b){var a={1:function(c){return(c%100!=11?"znak":"znakova")},2:function(c){return(c%100!=12?"znaka":"znakova")},3:function(c){return(c%100!=13?"znaka":"znakova")},4:function(c){return(c%100!=14?"znaka":"znakova")}};b.extend(b.fn.select2.defaults,{formatNoMatches:function(){return"Nema rezultata"},formatInputTooShort:function(d,e){var f=e-d.length;var c=f%10;if(c>0&&c<5){return"Unesite još "+f+" "+a[c](f)}return"Unesite još "+f+" znakova"},formatInputTooLong:function(e,d){var f=e.length-d;var c=f%10;if(c>0&&c<5){return"Unesite "+f+" "+a[c](f)+" manje"}return"Unesite "+f+" znakova manje"},formatSelectionTooBig:function(c){return"Maksimalan broj odabranih stavki je "+c},formatLoadMore:function(c){return"Učitavanje rezultata..."},formatSearching:function(){return"Pretraga..."}})})(jQuery);