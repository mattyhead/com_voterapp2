var jQuery_2_0_3 = $.noConflict(true);

var getHash = function() { return window.location.hash.substring(1) };

var ie = /msie ([0-9]+)\.[0-9]+/.exec(navigator.userAgent.toLowerCase());

var directionsService = new google.maps.DirectionsService();
var directionsRenderer = new google.maps.DirectionsRenderer({suppressMarkers:true});
var geocoder;
var map;
var bounds;
var markers = [];
var shapes = [];
var labels = [];
var marker;
var mayorAddress;
var pollingBounds;
var startMarker;
var endMarker;
var pollingAddress;
var wardDivision;
var searchBox;

var wardData;
var councilData;
var stateRepData;
var stateSenateData;
var usCongressData;

var divisions;
var wards;
var councilDistricts;
var paRepDistricts;
var paSenateDistricts;
var usCongressDistricts;

var clearShapes = function() {
  shapes.forEach(function(shape){
    shape.setMap(null);
  });
  labels.forEach(function(label){
    label.close();
  });
  shapes = [];
  labels = [];
};

var resetBounds = function() {
  bounds = new google.maps.LatLngBounds();
};

var showInfos = function() {
  jQuery_2_0_3('#polling-place-intro').hide();

  jQuery_2_0_3('#polling-place-info').show();


  jQuery_2_0_3('#elected-officials-intro').hide();
  jQuery_2_0_3('#elected-officials-info').show();

  jQuery_2_0_3('#maps-intro').hide();
  jQuery_2_0_3('#maps-info').show();
};

var addressIsProvided = function(addressInput) {
  return addressInput.value && addressInput.value !== jQuery_2_0_3(addressInput).attr("placeholder") && addressInput.value !== "Enter a query";
};

var addressEntered = function() {
  if(!searchBox || !addressIsProvided(document.getElementById('target'))) {
    return false;
  }

  var places = searchBox.getPlaces(),
      i,
      image,
      marker,
      strippedLocation,
      locationArray = [],
      dirtyLocation,
      urlLocation;

  clearCustomMap();

  if (directionsRenderer) {
    directionsRenderer.setMap(null);
  }


  //for (var i = 0, marker; marker = markers[i]; i++) {
  //marker.setMap(null);
  for (i = 0; i < markers.length; i++ ) {
    markers[i].setMap(null);
  }

  bounds = new google.maps.LatLngBounds();
  place = places[0];
  //for (var i = 0, place; place = places[i]; i++) {
  image = baseUri + 'components/com_voterapp/home.png';
  marker = new google.maps.Marker({
    map: map,
    icon: image,
    title: place.name,
    position: place.geometry.location
  });

  bounds.extend(place.geometry.location);

  startMarker = marker;
  markers.push(marker);

  //sanitize and parse location
  strippedLocation = String(place.geometry.location).replace(/ /g,'');
  locationArray = strippedLocation.split(",");
  dirtyLocation = locationArray[1]+"%2C"+locationArray[0];
  urlLocation = dirtyLocation.replace(/[()]/g,'');

  jQuery_2_0_3
    .getJSON("http://gis.phila.gov/ArcGIS/rest/services/PhilaGov/ServiceAreas/MapServer/22/query" +
                 "?text=&geometry="+urlLocation+"&geometryType=esriGeometryPoint&inSR=4326" +
                 "&spatialRel=esriSpatialRelWithin&relationParam=&objectIds=&where=1%3D1&time=" +
                 "&returnCountOnly=false&returnIdsOnly=false&returnGeometry=false&maxAllowableOffset=" +
                 "&outSR=&outFields=*&f=pjson&callback=?")
    .done(function(json){
      jQuery_2_0_3.each(json.features , function(key , value){ // First Level
        wardDivision = value.attributes.DIVISION_NUM;
      });
      if(!wardDivision || json.features.length === 0) {
        invalidAddress();
      } else {
        //parse wardDivision
        var ward = wardDivision.substring(0,2);
        var division = wardDivision.slice(-2);

        jQuery_2_0_3.ajax({
          type: "GET",
          url: baseUri + "index.php",
          data: {
            option: "com_divisions",
            view: "json",
            division_id: wardDivision
          },
          dataType: "json",
          async: false,
          success: function(json){
            var divisionAttributes = {},
                enableOption;
            jQuery_2_0_3.each(json.features , function(key , value){ // First Level
              divisionAttributes.id = value.attributes.division_id;
              divisionAttributes.ward = ward;
              divisionAttributes.division = division;
              divisionAttributes.congressionalDistrict = value.attributes.congressional_district;
              divisionAttributes.stateSenateDistrict = value.attributes.state_senate_district;
              divisionAttributes.stateRepresentativeDistrict = value.attributes.state_representative_district;
              divisionAttributes.councilDistrict = value.attributes.council_district;
              divisionAttributes.coordinates = [];
              value.attributes.coordinates.split(' ').forEach(function(c) {
                divisionAttributes.coordinates.push(c.split(','));
              });
            });

            populateDistrictSelectList(divisionAttributes);

            enableOption = function(name) {
              jQuery_2_0_3("option[value=" + name + "]").prop('disabled', false);
            };

            tabFunc(divisionAttributes);
            getDivisionShape(wardDivision).done(function(shape) {
              drawMap([{'name': shape.name, 'coordinates': shape.coordinates}]);
              enableOption('DIVISION');
            });

            // TODO: Make this asynchronous
            getWardShape(ward).done(function(shape) {
              wardData = shape;
              enableOption('WARD');
            });

            getCouncilShape(divisionAttributes.councilDistrict).done(function(shape) {
              councilData = shape;
              enableOption('COUNCIL');
            });

            getStateRepShape(divisionAttributes.stateRepresentativeDistrict).done(function(shape) {
              stateRepData = shape;
              enableOption('STATE_REP');
            });

            getStateSenateShape(divisionAttributes.stateSenateDistrict).done(function(shape) {
              stateSenateData = shape;
              enableOption('STATE_SENATE');
            });

            getUsCongressShape(divisionAttributes.congressionalDistrict).done(function(shape) {
              usCongressData = shape;
              enableOption('US_CONGRESS');
            });
          },
          error: function(XMLHttpRequest, textStatus, errorThrown) {
            alert(textStatus + " " + errorThrown);
          }
        });
      }
    });
};

//-----------------------------------------------------------------------------
// Divisions
//-----------------------------------------------------------------------------

var getDivisionShape = function(wardDivision) {
  var deferred = jQuery_2_0_3.Deferred();
  jQuery_2_0_3
    .getJSON("http://gis.phila.gov/ArcGIS/rest/services/PhilaGov/ServiceAreas" +
             "/MapServer/22/query?f=pjson&callback=?&outSR=4326" +
             "&where=DIVISION_NUM='" + wardDivision + "'")
      .done(function(json) {
        if (json.features) {
          deferred.resolve({
            coordinates: json.features[0].geometry.rings[0],
            color: '#FF0000',
            name: wardDivision
          });
        } else {
          deferred.reject();
        }
      });

  return deferred.promise();
};

//-----------------------------------------------------------------------------
// Wards
//-----------------------------------------------------------------------------

var getWardShape = function(ward) {
  var deferred = jQuery_2_0_3.Deferred();
  ward = parseInt(ward, 10);
  jQuery_2_0_3
    .getJSON("http://gis.phila.gov/ArcGIS/rest/services/PhilaGov/ServiceAreas" +
             "/MapServer/21/query?f=pjson&callback=?&outSR=4326" +
             "&where=WARD_NUM='" + ward + "'")
      .done(function(json) {
        if (json.features) {
          deferred.resolve({
            coordinates: json.features[0].geometry.rings[0],
            color: '#0000FF',
            name: ward
          });
        } else {
          deferred.reject();
        }
      });

  return deferred.promise();
};

//-----------------------------------------------------------------------------
// City Council Districts
//-----------------------------------------------------------------------------

var getCouncilShape = function(district) {
  var deferred = jQuery_2_0_3.Deferred();
  district = parseInt(district, 10);
  jQuery_2_0_3
    .getJSON("http://gis.phila.gov/ArcGIS/rest/services/PhilaGov/ServiceAreas" +
             "/MapServer/3/query?f=pjson&callback=?&outSR=4326" +
             "&where=DISTRICT='" + district + "'")
      .done(function(json) {
        if (json.features) {
          deferred.resolve({
            coordinates: json.features[0].geometry.rings[0],
            color: '#0D912E',
            name: district
          });
        } else {
          deferred.reject();
        }
      });

  return deferred.promise();
};

//-----------------------------------------------------------------------------
// State Rep Districts
//-----------------------------------------------------------------------------

var getStateRepShape = function(district) {
  var deferred = jQuery_2_0_3.Deferred();
  district = parseInt(district, 10);
  jQuery_2_0_3
    .getJSON("http://gis.phila.gov/arcgis/rest/services/PhilaGov/ServiceAreas" +
             "/MapServer/25/query?f=pjson&callback=?&outSR=4326" +
             "&where=DISTRICT_NUMBER='" + district + "'")
      .done(function(json) {
        if (json.features) {
          deferred.resolve({
            coordinates: json.features[0].geometry.rings[0],
            color: '#751675',
            name: district
          });
        } else {
          deferred.reject();
        }
      });

  return deferred.promise();
};

//-----------------------------------------------------------------------------
// State Senate Districts
//-----------------------------------------------------------------------------

var getStateSenateShape = function(district) {
  var deferred = jQuery_2_0_3.Deferred();
  district = parseInt(district, 10);
  jQuery_2_0_3
    .getJSON("http://gis.phila.gov/arcgis/rest/services/PhilaGov/ServiceAreas" +
             "/MapServer/24/query?f=pjson&callback=?&outSR=4326" +
             "&where=DISTRICT_NUMBER=" + district + "")
      .done(function(json) {
        if (json.features) {
          deferred.resolve({
            coordinates: json.features[0].geometry.rings[0],
            color: '#875010',
            name: district
          });
        } else {
          deferred.reject();
        }
      });

  return deferred.promise();
};

//-----------------------------------------------------------------------------
// US Congress
//-----------------------------------------------------------------------------

var getUsCongressShape = function(district) {
  var deferred = jQuery_2_0_3.Deferred();
  district = parseInt(district, 10);
  if (district < 10) {
    district = "0" + district;
  }

  jQuery_2_0_3
    .getJSON("http://maps1.arcgisonline.com/ArcGIS/rest/services" +
             "/USA_Congressional_Districts/MapServer/2/query?f=pjson&callback=?" +
             "&where=DISTRICTID='42" + district + "'")
      .done(function(json) {
        if (json.features) {
          deferred.resolve({
            coordinates: json.features[0].geometry.rings[0],
            color: '#0C727D',
            name: parseInt(district).toString()
          });
        } else {
          deferred.reject();
        }
      });

  return deferred.promise();
};

var addDistrictToList = function($list, text, type, disabled) {
  $list.append(jQuery_2_0_3("<option />").text(text).val(type).prop('disabled', !!disabled));
};

var populateDistrictSelectList = function(data) {
  var list = jQuery_2_0_3("#maps-district-type");
  list.empty();
  addDistrictToList(list, "Division " + data.ward + data.division, 'DIVISION');
  addDistrictToList(list, "Ward " + data.ward, 'WARD', true);
  addDistrictToList(list, "City Council District " + data.councilDistrict, 'COUNCIL', true);
  addDistrictToList(list, "State Rep District " + data.stateRepresentativeDistrict, 'STATE_REP', true);
  addDistrictToList(list, "State Senate District " + data.stateSenateDistrict, 'STATE_SENATE', true);
  addDistrictToList(list, "US Congress PA-" + data.congressionalDistrict, 'US_CONGRESS', true);
};

var bindDistrictSelectEvent = function(data) {
  var list = jQuery_2_0_3("#maps-district-type");
  list.unbind('change');
  list.change(function() {
    resetBounds();
    switch(list.val()) {
      case 'DIVISION':
        drawMap([data]);
        break;
      case 'WARD':
        drawMap([wardData]);
        break;
      case 'COUNCIL':
        drawMap([councilData]);
        break;
      case 'STATE_REP':
        drawMap([stateRepData]);
        break;
      case 'STATE_SENATE':
        drawMap([stateSenateData]);
        break;
      case 'US_CONGRESS':
        drawMap([usCongressData]);
        break;
      default:
        break;
    }
  });
};

var tabFunctions = {
  "nav-polling-place" : function(data) {
    getPollingPlace(data.ward, data.division);
    jQuery_2_0_3("#map-canvas").show();
    jQuery_2_0_3("#sample-pdf").hide();
  },
  "nav-elected-officials" : function(data) {
    getOfficials(data.congressionalDistrict, data.stateSenateDistrict,
                 data.stateRepresentativeDistrict, data.councilDistrict,
                 data.ward, data.division);
    jQuery_2_0_3("#map-canvas").show();
    jQuery_2_0_3("#sample-pdf").hide();
  },
  "nav-maps": function(data) {
    jQuery_2_0_3("#map-canvas").show();
    jQuery_2_0_3("#sample-pdf").hide();
    bindDistrictSelectEvent(data);
  },
  "nav-download-ballot": function(data) {
   getSampleBallot(data.ward, data.division);
    //var html = '<embed width="100%" height="100%" src="http://localhost/rolustech/ballotboxapp/ballot_paper/e9120fe0-d8c3-a4cc-6203-55277f730b01.pdf">';
    
    //jQuery_2_0_3("#sample-pdf").html(html);
    jQuery_2_0_3("#map-canvas").hide();
    jQuery_2_0_3("#sample-pdf").show();
  }
};

var tabFunc = function(data) {
  resetBounds();
  return tabFunctions[jQuery_2_0_3("#nav").find("li.active").attr("id")](
    data);
};

var getPolygonCentroid = function(pts) {
  var twicearea=0, x=0, y=0, nPts = pts.length, p1, p2, f;
  for ( var i=0, j=nPts-1 ; i<nPts ; j=i++ ) {
    p1 = pts[i]; p2 = pts[j];
    p1x = parseFloat(p1[0]); p1y = parseFloat(p1[1]);
    p2x = parseFloat(p2[0]); p2y = parseFloat(p2[1]);
    f = p1x*p2y - p2x*p1y;
    twicearea += f;
    x += ( p1x + p2x ) * f;
    y += ( p1y + p2y ) * f;
  }
  f = twicearea * 3;
  return new google.maps.LatLng(y/f, x/f);
};

var drawMap = function(shapesToDraw, keepShapes) {
  if (!keepShapes) {
    clearShapes();
  }

  shapesToDraw.forEach(function(shape) {
    var districtCoords = [];

    var centroid = getPolygonCentroid(shape.coordinates);

    shape.coordinates.forEach(function(coord) {
      var latLng = new google.maps.LatLng(coord[1], coord[0]);
      districtCoords.push(latLng);
      bounds.extend(latLng);
    });

    if (!shape.color) {
      shape.color = '#FF0000';
    }

    var districtPolygon = new google.maps.Polygon({
      paths: districtCoords,
      strokeColor: shape.color,
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: shape.color,
      fillOpacity: 0.3,
      clickable: false,
      map: map
    });

    var labelOpts = {
      content:  shape.name,
      position: centroid,
      closeBoxURL: "",
      boxStyle: {
        textAlign: "center",
        fontSize: "12px",
        backgroundColor: shape.color,
        color: "#fff",
        padding: "2px"
      }
    };

    var infoBox = new InfoBox(labelOpts);
    labels.push(infoBox);
    infoBox.open(map);

    shapes.push(districtPolygon);
  });
  map.fitBounds(bounds);
};

var setMapOptionsForPrint = function(setForPrint) {
  map.setOptions({
     mapTypeControl: !setForPrint,
     zoomControl: !setForPrint,
     streetViewControl: !setForPrint,
     panControl: !setForPrint
   });
};

var printMapInIE = function() {

  var popUpAndPrint = function() {

    setMapOptionsForPrint(true);
    var container = jQuery_2_0_3("#map-canvas"),
        origHeight = container.height(),
        origWidth = container.width();

    jQuery_2_0_3(".art-bar, .art-nav, .art-header, .art-header-inner, .art-nav-outer, .art-page-footer").hide();
    jQuery_2_0_3("#maps-custom-info, #maps-info").hide();
    jQuery_2_0_3(".leftmenu .col2").hide();
    jQuery_2_0_3("#map-canvas").width(origWidth * 2.0);
    jQuery_2_0_3("#map-canvas").height(origHeight * 1.5);
    document.window.print();
    jQuery_2_0_3("#map-canvas").height(origHeight);
    jQuery_2_0_3("#map-canvas").width(origWidth);
    jQuery_2_0_3("#maps-custom-info, #maps-info").show();
    jQuery_2_0_3(".art-bar, .art-nav, .art-header, .art-header-inner, .art-nav-outer, .art-page-footer").show();
    jQuery_2_0_3(".leftmenu .col2").show();

    setMapOptionsForPrint(false);
  };

  setTimeout(popUpAndPrint, 500);
};

var printMapInOther = function() {
  setMapOptionsForPrint(true);

  var popUpAndPrint = function() {
    var dataUrl = [];

    jQuery_2_0_3('#map-canvas canvas').filter(function() {
      dataUrl.push(this.toDataURL("image/png"));
    });

    var container = document.getElementById('map-canvas');
    var clone = container.cloneNode(true);

    var width = container.clientWidth;
    var height = container.clientHeight;

    jQuery_2_0_3(clone).find('canvas').each(function(i, item) {
      jQuery_2_0_3(item).replaceWith(
        jQuery_2_0_3('<img>')
          .attr('src', dataUrl[i]))
          .css('position', 'absolute')
          .css('left', '0')
          .css('top', '0')
          .css('width', width + 'px')
          .css('height', height + 'px');
    });

    var printWindow = window.open('', 'PrintMap',
      'width=' + width + ',height=' + height);
    if(!!printWindow) {

      printWindow.document.writeln(jQuery_2_0_3(clone).html());
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();

      setMapOptionsForPrint(false);
    }
  };

  setTimeout(popUpAndPrint, 500);
};

var printMap = function() {
  if (ie && ie[1] < 9) {
    printMapInIE();
  } else {
    printMapInOther();
  }
};

var setDirectionsText = function(legs) {
  // for each 'leg', display each of its steps -> instructions
  // in the .directions-text div
  var directionsArea = jQuery_2_0_3("div.directions-text"),
      directionsTable = jQuery_2_0_3("<table></table>");
  directionsArea.empty();

  jQuery_2_0_3.each(legs, function(idx, leg) {
      jQuery_2_0_3.each(leg.steps, function(i, step) {
        var newStepRow = jQuery_2_0_3("<tr></tr>");
        newStepRow
          .append(jQuery_2_0_3("<td></td>")
          .addClass("step-num")
          .append(i+1 + "."));
        newStepRow
          .append(jQuery_2_0_3("<td></td>")
          .append(jQuery_2_0_3("<span></span>")
            .addClass("directions-text-segment").append(step.instructions)));
        newStepRow
          .append(jQuery_2_0_3("<td></td>")
          .addClass("distance")
          .append(jQuery_2_0_3("<span></span>")
            .addClass("directions-text-segment-distance").append(step.distance.text)));

        directionsTable
        .append(newStepRow);
      });
  });
  directionsArea.append(directionsTable);
  directionsArea.show();
};

var getPollingPlace = function(ward, division) {
  //GET polling place from ward and division
  var pollingPinAddress = null,
      pollingDisplayAddress = null,
      pollingZipCode = null,
      pollingIntersection = null,
      pollingLocation = null,
      pollingBuilding = null,
      pollingBuildingLong = null,
      pollingParking = null,
      pollingParkingLong = null;
  jQuery_2_0_3('#polling-place-main').empty();

  jQuery_2_0_3.ajax({
    type: "GET",
    url: baseUri + "index.php",
    data: {
      option: "com_pollingplaces",
      view: "json",
      ward: ward,
      division: division
    },
    dataType: "json",
    async: false,
    success: function(json){
      jQuery_2_0_3.each(json.features , function(key , value){ // First Level
        pollingPinAddress = value.attributes.pin_address;
        pollingDisplayAddress = value.attributes.display_address;
        pollingZipCode = value.attributes.zip_code;
        pollingIntersection = value.attributes.intersection;
        pollingLocation = value.attributes.location;
        pollingLocation = pollingLocation.toProperCase();
        pollingBuilding = value.attributes.building;
        pollingParking = value.attributes.parking;
      });
    },
    error: function(XMLHttpRequest, textStatus, errorThrown) {
      alert(textStatus+" "+errorThrown);
    }
  });

  //Geocode polling place and place marker on map
  pollingAddress = pollingPinAddress + "," + pollingZipCode;
  if (jQuery_2_0_3('#nav-polling-place').hasClass('active')) {
    dropPollingPin(pollingAddress, wardDivision);
  } else {
    if (mayorAddress) {
      dropOfficePin(mayorAddress);
    } else {
      alert(mayorAddress);
    }
  }

  //Populate left column with polling place info
  if (pollingBuilding === 'F') {pollingBuildingLong = Joomla.JText._('BUILDING FULLY ACCESSIBLE')}
  else if (pollingBuilding === 'A') {pollingBuildingLong = Joomla.JText._('ALTERNATE ENTRANCE')}
  else if (pollingBuilding === 'B') {pollingBuildingLong = Joomla.JText._('BUILDING SUBSTANTIALLY ACCESSIBLE')}
  else if (pollingBuilding === 'R') {pollingBuildingLong = Joomla.JText._('ACCESSIBLE WITH RAMP')}
  else if (pollingBuilding === 'M') {pollingBuildingLong = Joomla.JText._('BUILDING ACCESSIBILITY MODIFIED')}
  else if (pollingBuilding === 'N') {pollingBuildingLong = Joomla.JText._('BUILDING NOT ACCESSIBLE')}

  if (pollingParking === 'N') {pollingParkingLong = Joomla.JText._('NO PARKING')}
  else if (pollingParking === 'H') {pollingParkingLong = Joomla.JText._('HANDICAP PARKING')}
  else if (pollingParking === 'L') {pollingParkingLong = Joomla.JText._('LOADING ZONE')}
  else if (pollingParking === 'G') {pollingParkingLong = Joomla.JText._('GENERAL PARKING')}

  var pollingPlaceInfo = '<div id="polling-place-info"><h3 class="polling-place-info-header">'+Joomla.JText._('YOUR POLLING PLACE')+'</h3><div id="polling-place-info-container"><br>'+
      '<div id="polling-info-card">'+
      '<strong>'+Joomla.JText._('WARD')+' '+ward+' '+Joomla.JText._('DIVISION')+' '+division+'</strong><br><hr>'+
      '<strong>'+Joomla.JText._('P_LOCATION')+' </strong><br/>'+pollingLocation+'<br/><br/>'+
      '<strong>'+Joomla.JText._('P_ADDRESS')+' </strong><br/>'+pollingDisplayAddress+'<br/>'+
      'Philadelphia, PA '+pollingZipCode+'<br/><br/>'+
      '<strong>'+Joomla.JText._('P_ACCESSIBILITY')+'</strong><br/><span id="polling-building">'+pollingBuildingLong+'</span><br/><br/>'+
      '<strong>'+Joomla.JText._('P_PARKING')+'</strong><br/><span id="polling-parking">'+pollingParkingLong+'</span><br/>'+
      '</div>' +
      '<br /></div>' +

//  var directionsInfo =
      '<h3 class="polling-place-directions-header">'+Joomla.JText._('DIRECTIONS')+'</h3><div id="polling-place-directions-container"><br>'+
      '<a href="javascript:void(0)" id="walking-directions" class="directions">'+Joomla.JText._('WALKING')+'</a> | '+
      '<a href="javascript:void(0)" id="bicycling-directions" class="directions">'+Joomla.JText._('BICYCLING')+'</a> | '+
      '<a href="javascript:void(0)" id="driving-directions" class="directions">'+Joomla.JText._('DRIVING')+'</a>' +
      '<br />' + 
      '<div class="directions-text"></div>' +
      '</div>' +
      '</div>';
  if (wardDivisionIsNotMappable(wardDivision)) {
    pollingPlaceInfo = '<div id ="polling-header"><h3>' + Joomla.JText._('YOUR POLLING PLACE') +
        '</h3></div><div><br><div id="polling-info-card-disclaimer"><br><p>' + Joomla.JText._('DISCLAIMER')
        +'</p></div>';
  }
  jQuery_2_0_3('#polling-place-main').empty();

  jQuery_2_0_3('#polling-place-main').html(pollingPlaceInfo);
  jQuery_2_0_3('#polling-place-info').accordion({ header: "h3", collapsible: true });

  //Directions between markers
  jQuery_2_0_3('#walking-directions').click(function() {
    jQuery_2_0_3(this).addClass('active');
    jQuery_2_0_3('#driving-directions').removeClass('active');
    jQuery_2_0_3('#bicycling-directions').removeClass('active');
    var request = {
      origin: startMarker.getPosition(),
      destination: endMarker.getPosition(),
      travelMode: google.maps.DirectionsTravelMode.WALKING
    };
    directionsService.route(request, function(result, status) {
      if (status === google.maps.DirectionsStatus.OK) {
        directionsRenderer.setMap(map);
        directionsRenderer.setDirections(result);
        setDirectionsText(result.routes[0].legs);
      }
    });
    return false;
  });
  jQuery_2_0_3('#driving-directions').click(function() {
    jQuery_2_0_3(this).addClass('active');
    jQuery_2_0_3('#walking-directions').removeClass('active');
    jQuery_2_0_3('#bicycling-directions').removeClass('active');
    var request = {
      origin: startMarker.getPosition(),
      destination: endMarker.getPosition(),
      travelMode: google.maps.DirectionsTravelMode.DRIVING
    };
    directionsService.route(request, function(result, status) {
      if (status === google.maps.DirectionsStatus.OK) {
        directionsRenderer.setMap(map);
        directionsRenderer.setDirections(result);
        setDirectionsText(result.routes[0].legs);
      }
    });
    return false;
  });
  jQuery_2_0_3('#bicycling-directions').click(function() {
    jQuery_2_0_3(this).addClass('active');
    jQuery_2_0_3('#driving-directions').removeClass('active');
    jQuery_2_0_3('#walking-directions').removeClass('active');
    var request = {
      origin: startMarker.getPosition(),
      destination: endMarker.getPosition(),
      travelMode: google.maps.DirectionsTravelMode.BICYCLING
    };
    directionsService.route(request, function(result, status) {
      if (status === google.maps.DirectionsStatus.OK) {
        directionsRenderer.setMap(map);
        directionsRenderer.setDirections(result);
        setDirectionsText(result.routes[0].legs);
      }
    });
    return false;
  });
};

//Get elected officials
var getOfficials = function(divisionCongressionalDistrict,
                            divisionStateSenateDistrict,
                            divisionStateRepresentativeDistrict,
                            divisionCouncilDistrict, ward,
                            division) {
  jQuery_2_0_3.ajax({
    type: "GET",
    url: baseUri + "index.php",
    data: {
      option: "com_electedofficials",
          view: "json",
          congressional_district: divisionCongressionalDistrict,
          state_senate_district: divisionStateSenateDistrict,
          state_representative_district: divisionStateRepresentativeDistrict,
          council_district: divisionCouncilDistrict
    },
    dataType: "json",
    async: false,
    success: function(json) {
      jQuery_2_0_3('.office-accordion').find('dd').html('');
      jQuery_2_0_3.each(json.officials , function(key , value) { // First Level
        var uuid = guid(),
            name = '',
            office_level = value.office_level,
            leadership_role = value.leadership_role,
            office = value.office,
            congressional_district = value.congressional_district,
            state_senate_district = value.state_senate_district,
            state_representative_district = value.state_representative_district,
            council_district = value.council_district;

        if (value.first_name) { name = value.first_name; }
        if (value.middle_name) {name = name+" "+value.middle_name;}
        if (value.last_name) {name = name+" "+value.last_name;}
        if (value.suffix) {name = name+" "+value.suffix;}
        party = value.party;
        first_elected = value.first_elected;
        next_election = value.next_election;
        website = value.website;
        email = value.email;
        main_contact_address_1 = value.main_contact_address_1;
        main_contact_address_2 = value.main_contact_address_2;
        main_contact_city = value.main_contact_city;
        main_contact_state = value.main_contact_state;
        main_contact_zip = value.main_contact_zip;
        main_contact_phone = value.main_contact_phone;
        main_contact_fax = value.main_contact_fax;
        local_contact_1_address_1 = value.local_contact_1_address_1;
        local_contact_1_address_2 = value.local_contact_1_address_2;
        local_contact_1_city = value.local_contact_1_city;
        local_contact_1_state = value.local_contact_1_state;
        local_contact_1_zip = value.local_contact_1_zip;
        local_contact_1_phone = value.local_contact_1_phone;
        local_contact_1_fax = value.local_contact_1_fax;
        local_contact_2_address_1 = value.local_contact_2_address_1;
        local_contact_2_address_2 = value.local_contact_2_address_2;
        local_contact_2_city = value.local_contact_2_city;
        local_contact_2_state = value.local_contact_2_state;
        local_contact_2_zip = value.local_contact_2_zip;
        local_contact_2_phone = value.local_contact_2_phone;
        local_contact_2_fax = value.local_contact_2_fax;
        local_contact_3_address_1 = value.local_contact_3_address_1;
        local_contact_3_address_2 = value.local_contact_3_address_2;
        local_contact_3_city = value.local_contact_3_city;
        local_contact_3_state = value.local_contact_3_state;
        local_contact_3_zip = value.local_contact_3_zip;
        local_contact_3_phone = value.local_contact_3_phone;
        local_contact_3_fax = value.local_contact_3_fax;

        var mainAddress = main_contact_address_1+','+main_contact_city+','+main_contact_state+' '+main_contact_zip,
            local1Address = local_contact_1_address_1+','+local_contact_1_city+','+local_contact_1_state+' '+local_contact_1_zip,
            local2Address = local_contact_2_address_1+','+local_contact_2_city+','+local_contact_2_state+' '+local_contact_2_zip,
            local3Address = local_contact_3_address_1+','+local_contact_3_city+','+local_contact_3_state+' '+local_contact_3_zip;

        var moreInfoDiv = '<div id="more-'+uuid+'" class="more-info-div">'+
            '<a href="javascript:void(0)" id="hide-more-link-'+uuid+'" onClick="hideMoreInfo(\''+uuid+'\')" class="hide-more-link"><i class="icon-angle-left icon-3x"></i></a>'+
            '<strong style="font-size:11px;">'+name+'</strong> ('+party+')<br>'+
            office+' '+leadership_role+'<br>';

        if (email) {moreInfoDiv = moreInfoDiv+'<br><a href="mailto:'+email+'" target="_top">'+Joomla.JText._('EMAIL')+' <i class="icon-envelope-alt"></i></a>';}
        if (website) {moreInfoDiv = moreInfoDiv+'<br><a href="http://'+website+'" target="_blank">'+Joomla.JText._('WEBSITE')+' <i class="icon-external-link"></i></a>';}
        if (main_contact_address_1 || main_contact_address_2 || main_contact_phone || main_contact_fax || main_contact_city || main_contact_state || main_contact_zip) {moreInfoDiv = moreInfoDiv + '<hr><h4><a href="javascript:void(0)" onClick="dropOfficePin(\''+mainAddress+'\')" >'+Joomla.JText._('MAIN OFFICE')+' <i class="icon-map-marker icon-large"></i></a></h4><br>';}
        if (main_contact_phone) {moreInfoDiv = moreInfoDiv+'<strong>'+Joomla.JText._('PHONE')+'</strong> '+main_contact_phone+'<br>';}
        if (main_contact_fax) {moreInfoDiv = moreInfoDiv+'<strong>'+Joomla.JText._('FAX')+'</strong> '+main_contact_fax+'<br>';}
        if (main_contact_address_1 || main_contact_address_2 || main_contact_city || main_contact_state || main_contact_zip) {moreInfoDiv = moreInfoDiv + '<br><strong>'+Joomla.JText._('OFFICE_ADDRESS')+'</strong><br>';}
        if (main_contact_address_1) {moreInfoDiv = moreInfoDiv+main_contact_address_1+'<br>';}
        if (main_contact_address_2) {moreInfoDiv = moreInfoDiv+main_contact_address_2+'<br>';}
        if (main_contact_city) {moreInfoDiv = moreInfoDiv+main_contact_city+', '+main_contact_state+' '+main_contact_zip+'<br>';}
        if (local_contact_1_address_1 || local_contact_1_address_2 || local_contact_1_phone || local_contact_1_fax || local_contact_1_city || local_contact_1_state || local_contact_1_zip) {moreInfoDiv = moreInfoDiv + '<hr><h4><a href="javascript:void(0)" onClick="dropOfficePin(\''+local1Address+'\')" >'+Joomla.JText._('LOCAL OFFICE')+' <i class="icon-map-marker icon-large"></i></a></h4><br>';}
        if (local_contact_1_phone) {moreInfoDiv = moreInfoDiv+'<strong>'+Joomla.JText._('PHONE')+'</strong> '+local_contact_1_phone+'<br>';}
        if (local_contact_1_fax) {moreInfoDiv = moreInfoDiv+'<strong>'+Joomla.JText._('FAX')+'</strong> '+local_contact_1_fax+'<br>';}
        if (local_contact_1_address_1 || local_contact_1_address_2 || local_contact_1_city || local_contact_1_state || local_contact_1_zip) {moreInfoDiv = moreInfoDiv + '<br><strong>'+Joomla.JText._('OFFICE_ADDRESS')+'</strong><br>';}
        if (local_contact_1_address_1) {moreInfoDiv = moreInfoDiv+local_contact_1_address_1+'<br>';}
        if (local_contact_1_address_2) {moreInfoDiv = moreInfoDiv+local_contact_1_address_2+'<br>';}
        if (local_contact_1_city) {moreInfoDiv = moreInfoDiv+local_contact_1_city+', '+local_contact_1_state+' '+local_contact_1_zip+'<br>';}
        if (local_contact_2_address_1 || local_contact_2_address_2 || local_contact_2_phone || local_contact_2_fax || local_contact_2_city || local_contact_2_state || local_contact_2_zip) {moreInfoDiv = moreInfoDiv + '<hr><h4><a href="javascript:void(0)" onClick="dropOfficePin(\''+local2Address+'\')" >'+Joomla.JText._('LOCAL OFFICE')+' <i class="icon-map-marker icon-large"></i></a></h4><br>';}
        if (local_contact_2_phone) {moreInfoDiv = moreInfoDiv+'<strong>'+Joomla.JText._('PHONE')+'</strong> '+local_contact_2_phone+'<br>';}
        if (local_contact_2_fax) {moreInfoDiv = moreInfoDiv+'<strong>'+Joomla.JText._('FAX')+'</strong> '+local_contact_2_fax+'<br>';}
        if (local_contact_2_address_1 || local_contact_2_address_2 || local_contact_2_city || local_contact_2_state || local_contact_2_zip) {moreInfoDiv = moreInfoDiv + '<br><strong>'+Joomla.JText._('OFFICE_ADDRESS')+'</strong><br>';}
        if (local_contact_2_address_1) {moreInfoDiv = moreInfoDiv+local_contact_2_address_1+'<br>';}
        if (local_contact_2_address_2) {moreInfoDiv = moreInfoDiv+local_contact_2_address_2+'<br>';}
        if (local_contact_2_city) {moreInfoDiv = moreInfoDiv+local_contact_2_city+', '+local_contact_2_state+' '+local_contact_2_zip+'<br>';}
        if (local_contact_3_address_1 || local_contact_3_address_2 || local_contact_3_phone || local_contact_3_fax || local_contact_3_city || local_contact_3_state || local_contact_3_zip) {moreInfoDiv = moreInfoDiv + '<hr><h4><a href="javascript:void(0)" onClick="dropOfficePin(\''+local3Address+'\')" >'+Joomla.JText._('LOCAL OFFICE')+' <i class="icon-map-marker icon-large"></i></a></h4><br>';}
        if (local_contact_3_phone) {moreInfoDiv = moreInfoDiv+'<strong>'+Joomla.JText._('PHONE')+'</strong> '+local_contact_3_phone+'<br>';}
        if (local_contact_3_fax) {moreInfoDiv = moreInfoDiv+'<strong>'+Joomla.JText._('FAX')+'</strong> '+local_contact_3_fax+'<br>';}
        if (local_contact_3_address_1 || local_contact_3_address_2 || local_contact_3_city || local_contact_3_state || local_contact_3_zip) {moreInfoDiv = moreInfoDiv + '<br><strong>'+Joomla.JText._('OFFICE_ADDRESS')+'</strong><br>';}
        if (local_contact_3_address_1) {moreInfoDiv = moreInfoDiv+local_contact_3_address_1+'<br>';}
        if (local_contact_3_address_2) {moreInfoDiv = moreInfoDiv+local_contact_3_address_2+'<br>';}
        if (local_contact_3_city) {moreInfoDiv = moreInfoDiv+local_contact_3_city+', '+local_contact_3_state+' '+local_contact_3_zip+'<br>';}
        moreInfoDiv = moreInfoDiv + '</div>';

        var basicInfoDiv = '<div id="basic-'+uuid+'" class="basic-official-info"><strong style="font-size:11px;">'+name+'</strong> ('+party+')<br>'+
            office+' '+leadership_role+'<br>';
        if (email) {basicInfoDiv = basicInfoDiv+'<br><a href="mailto:'+email+'" target="_top">'+Joomla.JText._('EMAIL')+' <i class="icon-envelope-alt"></i></a>';}
        if (website) {basicInfoDiv = basicInfoDiv+'<br><a href="http://'+website+'" target="_blank">'+Joomla.JText._('WEBSITE')+' <i class="icon-external-link"></i></a>';}
        basicInfoDiv = basicInfoDiv+'<br><a href="javascript:void(0)" class="more-info" id="show-more-link-'+uuid+'" onClick="showMoreInfo(\''+uuid+'\')">'+Joomla.JText._('MORE INFORMATION')+' <i class="icon-angle-right"></i></a><hr></div>';

        if  (office === 'President of the United States') {
          jQuery_2_0_3('#potus').append(basicInfoDiv);
          jQuery_2_0_3('#potus').append(moreInfoDiv);
        } else if  (office === 'U.S. Senate') {
          jQuery_2_0_3('#us-senators').append(basicInfoDiv);
          jQuery_2_0_3('#us-senators').append(moreInfoDiv);
        } else if (office === 'U.S. Representative') {
          jQuery_2_0_3('#us-representative').append(basicInfoDiv);
          jQuery_2_0_3('#us-representative').append(moreInfoDiv);
        } else if (office === 'Governor') {
          jQuery_2_0_3('#governor').append(basicInfoDiv);
          jQuery_2_0_3('#governor').append(moreInfoDiv);
        } else if (office === 'Lieutenant Governor') {
          jQuery_2_0_3('#lieutenant-governor').append(basicInfoDiv);
          jQuery_2_0_3('#lieutenant-governor').append(moreInfoDiv);
        } else if (office === 'Attorney General') {
          jQuery_2_0_3('#attorney-general').append(basicInfoDiv);
          jQuery_2_0_3('#attorney-general').append(moreInfoDiv);
        } else if (office === 'State Treasurer') {
          jQuery_2_0_3('#state-treasurer').append(basicInfoDiv);
          jQuery_2_0_3('#state-treasurer').append(moreInfoDiv);
        } else if (office === 'Auditor General') {
          jQuery_2_0_3('#auditor-general').append(basicInfoDiv);
          jQuery_2_0_3('#auditor-general').append(moreInfoDiv);
        } else if (office === 'State Senator') {
          jQuery_2_0_3('#state-senator').append(basicInfoDiv);
          jQuery_2_0_3('#state-senator').append(moreInfoDiv);
        } else if (office === 'State Representative') {
          jQuery_2_0_3('#state-representative').append(basicInfoDiv);
          jQuery_2_0_3('#state-representative').append(moreInfoDiv);
        } else if (office === 'Mayor') {
          jQuery_2_0_3('#mayor').append(basicInfoDiv);
          jQuery_2_0_3('#mayor').append(moreInfoDiv);
          mayorAddress = mainAddress;
        } else if (office === 'District Attorney') {
          jQuery_2_0_3('#district-attorney').append(basicInfoDiv);
          jQuery_2_0_3('#district-attorney').append(moreInfoDiv);
        } else if (office === 'City Controller') {
          jQuery_2_0_3('#city-controller').append(basicInfoDiv);
          jQuery_2_0_3('#city-controller').append(moreInfoDiv);
        } else if (office === 'Register of Wills') {
          jQuery_2_0_3('#register-of-wills').append(basicInfoDiv);
          jQuery_2_0_3('#register-of-wills').append(moreInfoDiv);
        } else if (office === 'Sheriff') {
          jQuery_2_0_3('#sheriff').append(basicInfoDiv);
          jQuery_2_0_3('#sheriff').append(moreInfoDiv);
        } else if (office === 'City Commissioner') {
          jQuery_2_0_3('#city-commissioners').append(basicInfoDiv);
          jQuery_2_0_3('#city-commissioners').append(moreInfoDiv);
        } else if (office === 'City Council At-Large') {
          jQuery_2_0_3('#city-council-at-large').append(basicInfoDiv);
          jQuery_2_0_3('#city-council-at-large').append(moreInfoDiv);
        } else if (office === 'City Council') {
          jQuery_2_0_3('#city-council').append(basicInfoDiv);
          jQuery_2_0_3('#city-council').append(moreInfoDiv);
        }
      });
      getPollingPlace(ward, division);
    },
    error: function(XMLHttpRequest, textStatus, errorThrown) {
      alert(textStatus+" "+errorThrown);
    }
  });
};

jQuery_2_0_3.support.cors = true;

String.prototype.toProperCase = function () {
  return this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
};

function s4() {
  return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
}

function guid() {
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
      s4() + '-' + s4() + s4() + s4();
}

function wardDivisionIsNotMappable(wardDivision) {
  return wardDivision === '815' || wardDivision === '816' || wardDivision === '824' || wardDivision === '830' || wardDivision === '904' || wardDivision === '905' || wardDivision === '906' || wardDivision === '911' || wardDivision === '912' || wardDivision === '913' || wardDivision === '916' || wardDivision === '1006' || wardDivision === '1020' || wardDivision === '1029' || wardDivision === '1101' || wardDivision === '1118' || wardDivision === '1205' || wardDivision === '1207' || wardDivision === '1210' || wardDivision === '1223' || wardDivision === '1305' || wardDivision === '1311' || wardDivision === '1317' || wardDivision === '1320' || wardDivision === '1322' || wardDivision === '1404' || wardDivision === '1405' || wardDivision === '1406' || wardDivision === '1411' || wardDivision === '1502' || wardDivision === '1507' || wardDivision === '1508' || wardDivision === '1509' || wardDivision === '1514' || wardDivision === '1516' || wardDivision === '1519' || wardDivision === '1605' || wardDivision === '1614' || wardDivision === '1616' || wardDivision === '1709' || wardDivision === '1712' || wardDivision === '1720' || wardDivision === '1725' || wardDivision === '1727' || wardDivision === '1805' || wardDivision === '1919' || wardDivision === '2005' || wardDivision === '2101' || wardDivision === '2102' || wardDivision === '2105' || wardDivision === '2106' || wardDivision === '2107' || wardDivision === '2108' || wardDivision === '2109' || wardDivision === '2110' || wardDivision === '2111' || wardDivision === '2112' || wardDivision === '2113' || wardDivision === '2114' || wardDivision === '2115' || wardDivision === '2120' || wardDivision === '2123' || wardDivision === '2125' || wardDivision === '2126' || wardDivision === '2127' || wardDivision === '2129' || wardDivision === '2130' || wardDivision === '2137' || wardDivision === '2138' || wardDivision === '2139' || wardDivision === '2140' || wardDivision === '2141' || wardDivision === '2144' || wardDivision === '2205' || wardDivision === '2216' || wardDivision === '2219' || wardDivision === '2222' || wardDivision === '2225' || wardDivision === '2226' || wardDivision === '2307' || wardDivision === '2310' || wardDivision === '2311' || wardDivision === '2314' || wardDivision === '2315' || wardDivision === '2316' || wardDivision === '2317' || wardDivision === '2401' || wardDivision === '2405' || wardDivision === '2406' || wardDivision === '2408' || wardDivision === '2410' || wardDivision === '2412' || wardDivision === '2505' || wardDivision === '2507' || wardDivision === '2510' || wardDivision === '2512' || wardDivision === '2517' || wardDivision === '2522' || wardDivision === '2601' || wardDivision === '2605' || wardDivision === '2607' || wardDivision === '2613' || wardDivision === '2620' || wardDivision === '2623' || wardDivision === '2701' || wardDivision === '2708' || wardDivision === '2710' || wardDivision === '2717' || wardDivision === '2720' || wardDivision === '2721' || wardDivision === '2808' || wardDivision === '2907' || wardDivision === '2910' || wardDivision === '2911' || wardDivision === '2917' || wardDivision === '3001' || wardDivision === '3015' || wardDivision === '3101' || wardDivision === '3104' || wardDivision === '3105' || wardDivision === '3107' || wardDivision === '3114' || wardDivision === '3119' || wardDivision === '3204' || wardDivision === '3217' || wardDivision === '3218' || wardDivision === '3220' || wardDivision === '3317' || wardDivision === '3321' || wardDivision === '3324' || wardDivision === '3422' || wardDivision === '3424' || wardDivision === '3425' || wardDivision === '3428' || wardDivision === '3440' || wardDivision === '3441' || wardDivision === '3504' || wardDivision === '3506' || wardDivision === '3507' || wardDivision === '3514' || wardDivision === '3516' || wardDivision === '3519' || wardDivision === '3524' || wardDivision === '3532' || wardDivision === '3603' || wardDivision === '3618' || wardDivision === '3628' || wardDivision === '3640' || wardDivision === '3701' || wardDivision === '3706' || wardDivision === '3719' || wardDivision === '3806' || wardDivision === '3813' || wardDivision === '3814' || wardDivision === '3815' || wardDivision === '3816' || wardDivision === '3817' || wardDivision === '3819' || wardDivision === '3820' || wardDivision === '3918' || wardDivision === '3946' || wardDivision === '4008' || wardDivision === '4012' || wardDivision === '4013' || wardDivision === '4019' || wardDivision === '4023' || wardDivision === '4030' || wardDivision === '4033' || wardDivision === '4034' || wardDivision === '4041' || wardDivision === '4042' || wardDivision === '4047' || wardDivision === '4117' || wardDivision === '4203' || wardDivision === '4204' || wardDivision === '4207' || wardDivision === '4209' || wardDivision === '4219' || wardDivision === '4221' || wardDivision === '4222' || wardDivision === '4301' || wardDivision === '4303' || wardDivision === '4403' || wardDivision === '4405' || wardDivision === '4408' || wardDivision === '4503' || wardDivision === '4506' || wardDivision === '4518' || wardDivision === '4525' || wardDivision === '4618' || wardDivision === '4620' || wardDivision === '4714' || wardDivision === '4804' || wardDivision === '4810' || wardDivision === '4811' || wardDivision === '4823' || wardDivision === '4903' || wardDivision === '4906' || wardDivision === '4917' || wardDivision === '4918' || wardDivision === '4921' || wardDivision === '4922' || wardDivision === '5003' || wardDivision === '5016' || wardDivision === '5102' || wardDivision === '5106' || wardDivision === '5117' || wardDivision === '5203' || wardDivision === '5206' || wardDivision === '5207' || wardDivision === '5208' || wardDivision === '5209' || wardDivision === '5210' || wardDivision === '5212' || wardDivision === '5213' || wardDivision === '5214' || wardDivision === '5215' || wardDivision === '5217' || wardDivision === '5218' || wardDivision === '5220' || wardDivision === '5221' || wardDivision === '5224' || wardDivision === '5225' || wardDivision === '5306' || wardDivision === '5404' || wardDivision === '5502' || wardDivision === '5601' || wardDivision === '5612' || wardDivision === '5613' || wardDivision === '5614' || wardDivision === '5619' || wardDivision === '5620' || wardDivision === '5626' || wardDivision === '5627' || wardDivision === '5639' || wardDivision === '5641' || wardDivision === '5701' || wardDivision === '5703' || wardDivision === '5705' || wardDivision === '5706' || wardDivision === '5709' || wardDivision === '5710' || wardDivision === '5713' || wardDivision === '5717' || wardDivision === '5718' || wardDivision === '5721' || wardDivision === '5727' || wardDivision === '5801' || wardDivision === '5803' || wardDivision === '5805' || wardDivision === '5807' || wardDivision === '5809' || wardDivision === '5810' || wardDivision === '5812' || wardDivision === '5813' || wardDivision === '5814' || wardDivision === '5816' || wardDivision === '5819' || wardDivision === '5823' || wardDivision === '5825' || wardDivision === '5826' || wardDivision === '5831' || wardDivision === '5833' || wardDivision === '5834' || wardDivision === '5837' || wardDivision === '5840' || wardDivision === '5841' || wardDivision === '5844' || wardDivision === '5906' || wardDivision === '5907' || wardDivision === '5913' || wardDivision === '5916' || wardDivision === '5924' || wardDivision === '6017' || wardDivision === '6105' || wardDivision === '6112' || wardDivision === '6116' || wardDivision === '6126' || wardDivision === '6127' || wardDivision === '6128' || wardDivision === '6202' || wardDivision === '6210' || wardDivision === '6217' || wardDivision === '6219' || wardDivision === '6225' || wardDivision === '6301' || wardDivision === '6304' || wardDivision === '6309' || wardDivision === '6310' || wardDivision === '6311' || wardDivision === '6312' || wardDivision === '6317' || wardDivision === '6318' || wardDivision === '6321' || wardDivision === '6323' || wardDivision === '6324' || wardDivision === '6414' || wardDivision === '6415' || wardDivision === '6503' || wardDivision === '6504' || wardDivision === '6505' || wardDivision === '6507' || wardDivision === '6516' || wardDivision === '6517' || wardDivision === '6518' || wardDivision === '6523' || wardDivision === '6603' || wardDivision === '6605' || wardDivision === '6606' || wardDivision === '6610' || wardDivision === '6613' || wardDivision === '6615' || wardDivision === '6617' || wardDivision === '6619' || wardDivision === '6621' || wardDivision === '6622' || wardDivision === '6624' || wardDivision === '6625' || wardDivision === '6629' || wardDivision === '6630' || wardDivision === '6632' || wardDivision === '6639' || wardDivision === '6640' || wardDivision === '6642' || wardDivision === '6214';
}

function showMoreInfo(officialInfo) {
  jQuery_2_0_3('#show-more-link-'+officialInfo).parent().hide();
  jQuery_2_0_3('#more-'+officialInfo).parent().scrollTop(0);
  jQuery_2_0_3('#show-more-link-'+officialInfo).parent().siblings().hide();
  jQuery_2_0_3('#more-'+officialInfo).fadeIn('slow');
  return false;
}

function hideMoreInfo(officialInfo) {
  jQuery_2_0_3('#more-'+officialInfo).hide();
  jQuery_2_0_3('#hide-more-link-'+officialInfo).parent().siblings('.basic-official-info').fadeIn('slow');
  return false;
}

function invalidAddress() {
  alert("The address you have chosen is invalid. Please select an address in Philadelphia.");
}

function dropOfficePin(sAddress) {

  for (var i = 2; i < markers.length; i++ ) {
    markers[i].setMap(null);
  }

  geocoder.geocode( {'address' : sAddress}, function(results, status) {
    if (status == google.maps.GeocoderStatus.OK) {
      bounds = new google.maps.LatLngBounds();
      bounds.extend(results[0].geometry.location); //extend map bounds to marker location
      map.fitBounds(bounds); //zoom and center map to fit markers


      var listener = google.maps.event.addListener(map, "idle", function() {
        if (map.getZoom() > 16) { map.setZoom(16); }
        google.maps.event.removeListener(listener);
      });

      //Marker for office
      var image = baseUri + 'components/com_voterapp/congress.png';
      var marker = new google.maps.Marker({
                                            map: map,
                                            icon: image,
                                            animation: google.maps.Animation.DROP,
                                            position: results[0].geometry.location,
                                            title: ''
                                          });

      markers.push(marker);
    } else {
      alert("Geocode of office location was not successful for the following reason: " + status);
    }
  });
}

function dropPollingPin(sAddress) {
  if (getHash() === 'elected-officials') {
    for (var i = 1, marker; marker = markers[i]; i++) {
      marker.setMap(null);
    }
  }

  bounds = new google.maps.LatLngBounds();

  geocoder.geocode( {'address' : sAddress}, function(results, status) {
    if (status === google.maps.GeocoderStatus.OK) {
      bounds.extend(results[0].geometry.location); //extend map bounds to marker location
      map.fitBounds(bounds); //zoom and center map to fit markers
      pollingBounds = bounds;

      var listener = google.maps.event.addListener(map, "idle", function() {
        if (map.getZoom() > 16) { map.setZoom(16); }
        google.maps.event.removeListener(listener);
      });

      //Marker for polling place
      var image = baseUri + 'components/com_voterapp/polling.png';
      var marker = new google.maps.Marker({
        map: map,
        icon: image,
        animation: google.maps.Animation.DROP,
        position: results[0].geometry.location,
        title: ''
      });
      if (wardDivisionIsNotMappable(wardDivision)) {
        marker.setVisible(false);
      }
      endMarker = marker;
      markers.push(marker);

    } else {
      alert("Geocode of polling place was not successful for the following reason: " + status);
    }
  });
}

function reCenterMap() {
  map.setCenter(new google.maps.LatLng(39.950, -75.1642));
}

function initialize() {
  geocoder = new google.maps.Geocoder();
  map = new google.maps.Map(document.getElementById('map-canvas'), {
    center: new google.maps.LatLng(39.9500, -75.1642),
    zoom: 12,
    streetViewControl: true,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  });

  //Address search box
  var input = /** @type {HTMLInputElement} */(document.getElementById('target'));
  searchBox = new google.maps.places.SearchBox(input);
  markers = [];

  google.maps.event.addListener(searchBox, 'places_changed', function() {
    showInfos();
    addressEntered();
  });

  google.maps.event.addListener(map, 'bounds_changed', function() {
    var bounds = map.getBounds();
    searchBox.setBounds(bounds);
  });
}

function setupMultipleSelects() {
  var matcher = function(term, text) {
    return text.toUpperCase().indexOf(term.toUpperCase()) == 0;
  };
  var args = {
    matcher: matcher
  };
  jQuery_2_0_3("#custom-divisions").select2(args);
  jQuery_2_0_3("#custom-wards").select2(args);
  jQuery_2_0_3("#custom-council-districts").select2(args);
  jQuery_2_0_3("#custom-parep-districts").select2(args);
  jQuery_2_0_3("#custom-pasen-districts").select2(args);
  jQuery_2_0_3("#custom-uscongress-districts").select2(args);
}

function clearCustomMap() {
  jQuery_2_0_3(".custom-map-selector").val([]).change()
}

function updateCustomMap() {
  clearShapes();
  reCenterMap();

  var defs = [],
      pushCoords = function(selector, getFunc) {
        var vals = jQuery_2_0_3.map(selector.select2('data'), function(v) {
        return v.text;
      });

    if (vals) {
      if (vals[0] === 'ALL') {
        vals = jQuery_2_0_3.map(selector.children(), function(v) {
          var val = jQuery_2_0_3(v).val();
          if (val !== 'ALL') {
            return val;
          }
        });
      }
      vals.forEach(function(val) {
        defs.push(getFunc(val));
      });
    }
  };

  var divs      = jQuery_2_0_3("#custom-divisions"),
      wrds      = jQuery_2_0_3("#custom-wards"),
      councils  = jQuery_2_0_3("#custom-council-districts"),
      pareps    = jQuery_2_0_3("#custom-parep-districts"),
      pasens    = jQuery_2_0_3("#custom-pasen-districts"),
      uscongs   = jQuery_2_0_3("#custom-uscongress-districts");

  var tasks = [
    [divs,      getDivisionShape],
    [wrds,      getWardShape],
    [councils,  getCouncilShape],
    [pareps,    getStateRepShape],
    [pasens,    getStateSenateShape],
    [uscongs,   getUsCongressShape]
  ];

  tasks.forEach(function(t) {
    pushCoords(t[0], t[1]);
  });

  if (defs.length) {
    jQuery_2_0_3('#maps-intro').show();
    jQuery_2_0_3('#maps-info').hide();
  }

  jQuery_2_0_3.when.apply(jQuery_2_0_3, defs).then(function() {
    var shapes = Array.prototype.slice.call(arguments);
    if (shapes.length > 0) {
      resetBounds();
      drawMap(shapes, true);
    }
  });
}

//navigation
//
jQuery_2_0_3( document ).ready(function() {
  setupMultipleSelects();

  var officeLevelPanels = jQuery_2_0_3('.office-level-accordion > dd').hide();

  jQuery_2_0_3('.office-level-accordion > dt > a').click(function() {
    officeLevelPanels.slideUp();
    if ( jQuery_2_0_3(this).hasClass("active") ) {
      jQuery_2_0_3(this).removeClass("active");
    } else {
      jQuery_2_0_3(this).parent().next().slideDown();
      jQuery_2_0_3(this).addClass('active');
    }
    return false;
  });

  var officePanels = jQuery_2_0_3('.office-accordion > dd').hide();

  jQuery_2_0_3('.office-accordion > dt > a').click(function() {
    officePanels.slideUp();
    if ( jQuery_2_0_3(this).hasClass("active") ) {
      jQuery_2_0_3(this).removeClass("active");
    } else {
      jQuery_2_0_3(this).parent().next().slideDown();
      jQuery_2_0_3(this).addClass('active');
    }
    return false;
  });

  jQuery_2_0_3('#nav-polling-place').on("click", function() {
    activatePolling(wardDivision);
  });

  jQuery_2_0_3('#nav-elected-officials').on("click", function(){
    activateOfficials();
  });

  jQuery_2_0_3('#nav-maps').on("click", function(){
    activateMaps();
  });

  jQuery_2_0_3('#nav-download-ballot').on("click", function(){
    activateDownloadBallot();
  });
  
  jQuery_2_0_3('.custom-map-selector').change(function(e) {
    var selector = jQuery_2_0_3(e.target);
    var val = jQuery_2_0_3.map(selector.select2("data"), function(item) {
      return item.text;
    });
    jQuery_2_0_3.each(val, function(i, v) {
      if (e.added && e.added.text === 'ALL') {
        if (v !== 'ALL') {
          val.splice(i, 1);
        }
      } else {
        if (v === 'ALL') {
          val.splice(i, 1);
        }
      }
    });
    selector.select2("val", val);
    updateCustomMap();
  });

  function resetLayout() {
    clearShapes();
    jQuery_2_0_3('#nav-elected-officials').removeClass("active");
    jQuery_2_0_3('#nav-polling-place').removeClass("active");
    jQuery_2_0_3('#nav-maps').removeClass("active");
    jQuery_2_0_3('#nav-download-ballot').removeClass("active");
    jQuery_2_0_3('#polling-place').hide();
    jQuery_2_0_3('#elected-officials').hide();
    jQuery_2_0_3('#maps').hide();
    jQuery_2_0_3('#download-ballot').hide();
  }

  function showOfficials() {
    resetLayout();
    jQuery_2_0_3('#nav-elected-officials').addClass("active");
    jQuery_2_0_3('#elected-officials').show();
    jQuery_2_0_3('#print-map').css({
        'display':'inline',
        'position':'absolute'
    });
    addressEntered();
  }

  function showPolling() {
    resetLayout();
    jQuery_2_0_3('#nav-polling-place').addClass("active");
    jQuery_2_0_3('#polling-place').show();
    jQuery_2_0_3('#print-map').css({
        'display':'inline',
        'position':'absolute'
    });
    addressEntered();
  }
  function showDownloadBallot() {
    resetLayout();
    jQuery_2_0_3('#nav-download-ballot').addClass("active");
    jQuery_2_0_3('#download-ballot').show();
    jQuery_2_0_3('#print-map').hide();
    addressEntered();
  }

  function populateCustomOptions(selector, cache, key, url) {
    var dropDown = jQuery_2_0_3(selector);

    if (cache) {
      dropDown.append(jQuery_2_0_3("<option>").text('ALL'));
      cache.forEach(function(v) {
        dropDown.append(jQuery_2_0_3("<option>").text(v[key]));
      });
      dropDown.prop('disabled', false);
    } else {
      jQuery_2_0_3
        .getJSON(url)
          .done(function(json) {
            cache = json;
            populateCustomOptions(selector, cache, key, url);
          });
    }
  }

  function showMaps() {
    resetLayout();
    jQuery_2_0_3('#nav-maps').addClass("active");
    jQuery_2_0_3('#maps').show();
    jQuery_2_0_3('#print-map').css({
        'display':'inline',
        'position':'absolute'
    });
    populateCustomOptions("#custom-divisions", divisions, "division_id",
      baseUri + "index.php?option=com_divisions&view=all");
    populateCustomOptions("#custom-wards", wards, "ward",
      baseUri + "index.php?option=com_divisions&view=ward");
    populateCustomOptions("#custom-council-districts", councilDistricts, "council_district",
      baseUri + "index.php?option=com_divisions&view=council");
    populateCustomOptions("#custom-parep-districts", paRepDistricts, "state_representative_district",
      baseUri + "index.php?option=com_divisions&view=parep");
    populateCustomOptions("#custom-pasen-districts", paRepDistricts, "state_senate_district",
      baseUri + "index.php?option=com_divisions&view=pasenate");
    populateCustomOptions("#custom-uscongress-districts", usCongressDistricts, "congressional_district",
      baseUri + "index.php?option=com_divisions&view=uscongress");
    addressEntered();
  }

  function activateMaps() {
    showMaps();
    return false;
  }

  function activateOfficials() {
    showOfficials();
    officePanels.hide();
    officeLevelPanels.hide();
    jQuery_2_0_3('#local-accordion').slideDown();
    jQuery_2_0_3('#mayor').slideDown();
    if (mayorAddress) {
      dropOfficePin(mayorAddress);
    }
    return false;
  }

  function activatePolling() {
    showPolling();
    return false;
  }
  function activateDownloadBallot() {
    showDownloadBallot();
    return false;
  }

  var hashChanged = function() {
    // Allow direct linking
    var hash = getHash();
    if (hash === 'elected-officials') {
      showOfficials();
    } else if (hash === 'polling-place') {
      showPolling();
    } else if (hash === 'maps') {
      showMaps();
    }else if (hash === 'ballots') {
      showDownloadBallot();
    }
  };

  if (("onhashchange" in window) && !ie) {
    jQuery_2_0_3(window).bind('hashchange', function() {
      hashChanged();
    });
  }
  else {
    var prevHash = window.location.hash;
    window.setInterval(function () {
      if (window.location.hash != prevHash) {
        hashChanged();
      }
    }, 100);
  }

  hashChanged();
});

function getSampleBallot(ward , division){
    
    var sample_div = ward+"-"+division;
    //var el = jQuery_2_0_3("#download-ballot-info > #ballot-file-path");
    var el_parent = jQuery_2_0_3("#download-ballot-intro");
    //var count = Object.keys(ward_divisions_files).length;
    if(typeof ward_divisions_files==='undefined' || !ward_divisions_files){
        
        var inner_html = '<h3>'+getMessgaeAndText('DOWNLOAD BALLOT INTRO HEADER NO BALLOT')+'</h3><br/><p>'+getMessgaeAndText('DOWNLOAD BALLOT INTRO TEXT NO BALLOT')+'</p>';
        jQuery_2_0_3(el_parent).html(inner_html);
        jQuery_2_0_3("#sample-pdf").html("");
        return ;
    }
    if(typeof ward_divisions_files[sample_div] !=='undefined'){
        if(typeof ward_divisions_files[sample_div].file_id!=='undefined'){
            if(ward_divisions_files[sample_div].file_id!=''){
                
                //<object width="100%" height="645" type="application/pdf" data="http://staging.rolustech.com/ballotboxapp/ballot_paper/deafaa2a-1690-f2c8-1d77-552beb2dda97d1.pdf?#zoom=50&amp;scrollbar=1&amp;toolbar=0&amp;navpanes=0" id="pdf_content">pdf not avaliable</object>
                //<object width="100%" height="645" type="application/pdf" data="https://www.msu.edu/~urban/sme865/resources/sme_865_dreamweaver_intro.pdf?#zoom=50&amp;scrollbar=1&amp;toolbar=0&amp;navpanes=0" id="pdf_content">pdf not avaliable</object>
                var pdf_url = baseUri+'ballot_paper/'+ward_divisions_files[sample_div].file_id+'.pdf';
                
                var html = '<object width="100%" height="100%" data="'+pdf_url+'?#zoom=0&amp;scrollbar=1&amp;toolbar=0&amp;navpanes=0" type="application/pdf">NO PDF FOUND</object>';
                
                jQuery_2_0_3("#sample-pdf").html(html);
                //jQuery_2_0_3(el).attr('href' , pdf_url);
                //jQuery_2_0_3(el).attr('target' , '_blank');
                var inner_html = '<h3>'+getMessgaeAndText('DOWNLOAD BALLOT INTRO HEADER AFTER')+'</h3><p>'+getMessgaeAndText('DOWNLOAD BALLOT INTRO TEXT AFTER')+'</p><br/><a href="'+baseUri+'ballot_paper/'+ward_divisions_files[sample_div].file_id+'.pdf" target="_blank" class="showPDF">'+getMessgaeAndText('DOWNLOAD BALLOT BUTTON TEXT')+'</a><hr>';
                jQuery_2_0_3(el_parent).html(inner_html);
                /* Looping for other ballot */
                var unique = [];
                var unique_wards = [];
                jQuery.each(ward_divisions_files, function (i, val) {
                  
                  if ((unique.indexOf(val.sid) === - 1)) {
                    unique.push(val.sid);
                    unique_wards.push(i);
                  }
                });
                //Generate other downloads here
                var other_htm = '';
                if(unique.length > 1){
                    other_htm+= '<select id="ballots_dropdown" name="ballots_dropdown" ><option value="">'+getMessgaeAndText('DOWNLOAD BALLOT EMPTY DROPDOWN TEXT')+'</option>';
                    var sort = [];
                    var special_sort = [];
                    for(var i=0;i < unique_wards.length; i++){
                        //console.log(ward_divisions_files[unique_wards[i]].file_id+"  "+ward_divisions_files[sample_div].file_id);
                        //if(ward_divisions_files[unique_wards[i]].file_id!=ward_divisions_files[sample_div].file_id){
                            //console.log("Inside ");
                            //var res = unique_wards[i].split("-");
                            //other_htm+='<a herf="javascript:void(0)" onclick="getSampleBallot(\''+res[0]+'\' , \''+res[1]+'\')" class="showPDF">Spilt '+ward_divisions_files[unique_wards[i]].sid+'</a><br/>';
                            //other_htm+='<a href="'+baseUri+'ballot_paper/'+ward_divisions_files[unique_wards[i]].file_id+'.pdf" target="_blank" class="showPDF">Spilt '+ward_divisions_files[unique_wards[i]].sid+'</a><br/>';
                            if(typeof ward_divisions_files[unique_wards[i]].special_bit !=='undefined'){
                                special_sort.push(ward_divisions_files[unique_wards[i]].sid);
                            }else{
                                sort.push(ward_divisions_files[unique_wards[i]].sid);
                            }
                            //other_htm+='<option value="'+ward_divisions_files[unique_wards[i]].file_id+'">Spilt '+ward_divisions_files[unique_wards[i]].sid+'</option>';
                        //}
                    }
                    var a = sort.sort();
                    var s = special_sort.sort();
                    var children = a.concat(s);
                    for(var j=0; j < children.length;j++){
                        for(var i=0;i < unique_wards.length; i++){
                            if(children[j] == ward_divisions_files[unique_wards[i]].sid){
                                other_htm+='<option value="'+ward_divisions_files[unique_wards[i]].file_id+'">Spilt '+ward_divisions_files[unique_wards[i]].sid+'</option>';
                            }
                        }
                    }
                    //console.log(children);
                    other_htm+='</select><p align="center"><br/><button value="Show Me" name="Show Me" onclick="showBallotDropdown()">'+getMessgaeAndText('SHOW ME TEXT')+'</button></p>';
                }
                var htm = '<h3>'+getMessgaeAndText('OTHER SAMPLE BALLOTS HEADER')+'</h3><p>'+getMessgaeAndText('OTHER SAMPLE BALLOTS TEXT')+'</p><br/>'+other_htm;
                jQuery_2_0_3("#download-ballot-info").html(htm);
                jQuery_2_0_3("#download-ballot-info").show();
                

                
                
                return ;
            }
        }
    }
    
    var inner_html = '<h3>'+getMessgaeAndText('DOWNLOAD BALLOT INTRO HEADER NO BALLOT')+'</h3><p>'+getMessgaeAndText('DOWNLOAD BALLOT INTRO TEXT NO BALLOT')+'</p>';
    jQuery_2_0_3(el_parent).html(inner_html);
    jQuery_2_0_3("#sample-pdf").html("");
    //jQuery_2_0_3("#map-canvas").html(html);
    jQuery_2_0_3(el).attr('href' , 'javascript:void(0)');
    jQuery_2_0_3(el).attr('target' , '');
}

function getMessgaeAndText(code){
var messages = {
        "DOWNLOAD BALLOT INTRO TEXT NO BALLOT": Joomla.JText._('DOWNLOAD BALLOT INTRO TEXT NO BALLOT'),
        "OTHER SAMPLE BALLOTS TEXT": Joomla.JText._('OTHER SAMPLE BALLOTS TEXT'),
        "OTHER SAMPLE BALLOTS HEADER": Joomla.JText._('OTHER SAMPLE BALLOTS HEADER'),
        "DOWNLOAD BALLOT INTRO TEXT AFTER": Joomla.JText._('DOWNLOAD BALLOT INTRO TEXT AFTER'),
        "DOWNLOAD BALLOT INTRO HEADER AFTER": Joomla.JText._('DOWNLOAD BALLOT INTRO HEADER AFTER'),
        "DOWNLOAD BALLOT INTRO HEADER": Joomla.JText._('DOWNLOAD BALLOT INTRO HEADER'),
        "OTHER SAMPLE BALLOTS HEADER": Joomla.JText._('OTHER SAMPLE BALLOTS HEADER'),
        "DOWNLOAD BALLOT INTRO HEADER NO BALLOT": Joomla.JText._('DOWNLOAD BALLOT INTRO HEADER NO BALLOT'),
        "DOWNLOAD BALLOT BUTTON TEXT": Joomla.JText._('DOWNLOAD BALLOT BUTTON TEXT'),
        "DOWNLOAD BALLOT EMPTY DROPDOWN TEXT": Joomla.JText._('DOWNLOAD BALLOT EMPTY DROPDOWN TEXT'),
        "SHOW ME TEXT": Joomla.JText._('SHOW ME TEXT'),
    };
    return messages[code];
}

function showBallotDropdown(){
    var file_id = jQuery_2_0_3("#ballots_dropdown").val();
    if(file_id!=''){
        
        var link = baseUri+'ballot_paper/'+file_id+'.pdf';
        
        var win = window.open(link, '_blank');
        win.focus();
    }else{
        alert();
    }
}
google.maps.event.addDomListener(window, 'load', initialize);
