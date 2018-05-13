#! /bin/zsh

#SOQL_QUERY="SELECT count(*), date_trunc_ymd(call_received) as call_date GROUP BY call_date"
#SOQL_QUERY="SELECT date_trunc_ymd(call_received) as call_date GROUP BY call_date |> SELECT count(call_date)"
SOQL_QUERY="SELECT count(*)"
 http --verbose "https://data.nashville.gov/resource/28i3-48zr.json?\$\$app_token=ZBIG3Lx4BagIQAnFaSxdXbo2s&\$query=${SOQL_QUERY}"

 <script src="https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v2.2.0/mapbox-gl-geocoder.min.js"></script>
<link rel="stylesheet" href="https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v2.2.0/mapbox-gl-geocoder.css" type="text/css" />

