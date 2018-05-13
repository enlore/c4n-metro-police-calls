;(function ({ mapboxgl, MapboxGeocoder }) { 
  // Dataset
  // docs - https://dev.socrata.com/foundry/data.nashville.gov/28i3-48zr
  // portal - https://data.nashville.gov/Police/Metro-Nashville-Davidson-County-Calls-For-Police-S/kqb6-kd6q

  const callPopup = new mapboxgl.Popup()  
  const rowCount = document.getElementById('rowCount')
  rowCount.innerText = 0
  
  const dayScrubber = document.getElementById('dayScrubber')
  if (dayScrubber) { 
    dayScrubber.setAttribute('value', dayScrubber.max); 
    dayScrubber.setAttribute('disabled', true) 
  }
  
  const dateSelection = document.getElementById('dateSelection')
  
  mapboxgl.accessToken = 'pk.eyJ1Ijoibmljay1hdC1mb2ciLCJhIjoiY2poNDlmYzV4MGxmYTMzb2F5eXJtMmhyZSJ9.6t-4WlMIZc5yjctGUu4XVQ';
  
  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v10',
    center: [ -86.7816, 36.1627 ],
    zoom: 12,
    //   hash: true,
  })

  // todo colors for different call descriptions? seems unreasonable,
  // the first 1000 calls exhibit 34 different labels for `description` prop
  const colors = []

  function popColor () {
    return colors.pop() || 'cyan'
  }
  
  map.on('load', () => {
     map.addSource('geocoder-result', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      })

      map.addLayer({
        id: 'geocoder-pin',
        source: 'geocoder-result',
        type: 'circle',
        paint: { 'circle-radius': 14, 'circle-color': 'green' }
      })

      const geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken
      })

      map.addControl(geocoder)

      geocoder.on('result', (ev) => {
        map.getSource('geocoder-result').setData(ev.result.geometry)
      })
    const socrataToken = 'ZBIG3Lx4BagIQAnFaSxdXbo2s'
    const query = `
      SELECT 
        description,
        tencode,
        tencode_suffixf_description,
        unit_dispatched,
        event_number,
        call_received, 
        date_trunc_ymd(call_received) as $call_date,
        shift, 
        disposition_description, 
        mapped_location, 
        street_name,
        block,
        zone
      ORDER BY call_received DESC
      LIMIT 20000`
    
    fetch(`https://data.nashville.gov/resource/28i3-48zr.json?$$app_token=${socrataToken}&$query=${query}`)
      // wild and free i just believe
      .then(resp => resp.json())
      .then(body => {
        const descriptionToColor = body.reduce((acc, call) => {
          if (! ~acc.indexOf(call.description)) {
            // results in "DESCRIPTION_TEXT", "HEX_COLOR" pairs used later as
            // arguments to a mapbox layer expression
            acc.push(call.description)
            acc.push(popColor())
          }

          return acc
        }, [])

        const callFeatures = genFeatures(body)
        rowCount.innerText = callFeatures.length
        
        const days = Object.keys(callFeatures.reduce((acc, f) => {
            acc[f.properties.$call_date] = 0
            return acc
          }, {}))
        
        if (dayScrubber) {
          dayScrubber.setAttribute('max', days.length - 1)
          dayScrubber.setAttribute('value', dayScrubber.max)
          
          dateSelection.innerText = days[0].split('T')[0]
          
          dayScrubber.removeAttribute('disabled')
   
          dayScrubber.addEventListener('input', ev => {
            let len = days.length - 1
            
            const val = parseInt(ev.target.value, 10)
            
            setDayFilter(map, days[len - val])
            
            dateSelection.innerText = days[len - val].split('T')[0]
            
            callPopup.remove()
            
            console.info('filter set to ', val, days[len - val])
          })
        
          console.info('dayScrubber - total days:', dayScrubber.max, 'days in result set:', days)
        }
      
        console.info('data - calls for service:', callFeatures.length)
        console.info(`${descriptionToColor.length / 2} different description labels`)
        console.table(descriptionToColor.filter(l => l !== 'cyan'))
      
        map.addSource('police-calls', {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: callFeatures
          }
        })

        map.addLayer({
          id: 'call-points',
          type: 'circle',
          paint: {
            'circle-radius': 9,
            'circle-color': [
              'match',
              ['to-string', [ 'get', 'description' ]],
              ...descriptionToColor, // everything is cyan
              'lightblue'
            ]
          },
          source: "police-calls"
        }, 'geocoder-pin')

        map.addLayer({
          id: 'call-labels',
          type: 'symbol',
          source: 'police-calls',
          layout: {
            'text-field': ['to-string', [ 'get', 'description' ]],
            'text-anchor': 'left',
            'text-justify': 'left',
            'text-offset': [1, 0]
          },
          paint: {
            'text-color': 'black'
          }
        }, 'geocoder-pin')
      
        setDayFilter(map, days[0])  

        map.on('click', 'call-points', (ev) => {
          const call = ev.features[0]

          map.once('moveend', () => {
            showPopup(callPopup, call)
          })

          map.flyTo({
            center: call.geometry.coordinates,
            zoom: 17
          });
        })

        map.on('mouseenter', 'call-points', () => {
          map.getCanvas().style.cursor = 'pointer'
        })


        map.on('mouseleave', 'call-points', function () {
          map.getCanvas().style.cursor = '';
        });
    })
    .catch(err => console.error('error on map load', err))
  })
  
  function setDayFilter (map, date) { 
    map.setFilter('call-points', ['==', '$call_date', date])
    map.setFilter('call-labels', ['==', '$call_date', date])
  }

  function genFeatures (policeCalls) {
    return policeCalls.map(genFeatureFor)
  }

  function genFeatureFor(policeCall) {
    const mapped_location = policeCall.mapped_location
    const mapped_location_address = policeCall.mapped_location_address
    const coordinates = mapped_location && mapped_location.coordinates || []

    const date =  new Date(policeCall.call_received)
    
    return { 
      properties: {
        description: policeCall.description,
        tencode: policeCall.tencode,
        tencode_suffix_description: policeCall.tencode_suffix_description,
        unit_dispatched: policeCall.unit_dispatched,
        zone: policeCall.zone,
        event_number: policeCall.event_number,
        call_received: policeCall.call_received,
        $call_date: policeCall.$call_date,
        shift: policeCall.shift,
        disposition_description: policeCall.disposition_description,
        street_name: policeCall.street_name,
        block: policeCall.block
      },
      geometry: {
        type: "Point",
        coordinates
      }
    }
  }

  function showPopup (popup, { // call object 
    geometry: { coordinates }, 
    properties: {
      description,
      tencode,
      tencode_suffix_description,
      unit_dispatched,
      zone,
      event_number,
      call_received,
      disposition_description,
      shift,
      street_name,
      block
    }
  }) {
    popup
      .setLngLat(coordinates)
      .setHTML(`
<div class="callInfo">
  <h2 class="f__inline"> 10-${tencode} </h2>        
  <h3 style="padding-left: 4px;" class="f__inline f__right"> ${description} </h3>
  <p> <span class="f__fade"> Unit </span> ${unit_dispatched} <span class="f__fade"> dispatched to </span> ${block} block, ${street_name} </p>
  
  <table>
    <tr>
      <td class="f__fade"> ECC CAD System ID </td>
      <td class="f__right"> ${event_number} </td>
    </tr>
    <tr>
      <td class="f__fade"> Received At </td>
      <td class="f__right"> ${call_received.split('T')[1].split('.')[0]} during shift ${shift} </td>
    </tr>
    <tr>
      <td class="f__fade"> Unit Dispatched </td>
      <td class="f__right"> ${unit_dispatched} </td>
    </tr>
    <!--
    <tr>
      <td class="f__fade"> Zone </td>
      <td class="f__right"> ${zone} </td>
    </tr>
    -->
    <tr>
      <td class="f__fade"> Outcome </td>
      <td class="f__right"> ${disposition_description} </td>
    </tr>
    <tr>
      <td class="f__fade"> Coordinates </td>
      <td class="f__right"> ${coordinates.join(', ')} </td>
    </tr>
  </table>

  </div>
      `)
      .addTo(map)
  }
})(this)