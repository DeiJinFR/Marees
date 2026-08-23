export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ erreur: 'Méthode non autorisée' });
    return;
  }

  const { city } = req.body;

  if (!city) {
    res.status(400).json({ erreur: 'Paramètre city manquant' });
    return;
  }

  try {
    const result = await searchTideCity(city);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ erreur: err.message || 'Erreur serveur' });
  }
}

const COASTAL_CITIES = {
  'brest': { lat: 48.383, lng: -4.495, ref_station: 'Brest' },
  'cherbourg': { lat: 49.633, lng: -1.633, ref_station: 'Cherbourg' },
  'la rochelle': { lat: 46.158, lng: -1.151, ref_station: 'La Rochelle' },
  'dieppe': { lat: 49.928, lng: 1.079, ref_station: 'Dieppe' },
  'honfleur': { lat: 49.415, lng: 0.235, ref_station: 'Honfleur' },
  'saint-malo': { lat: 48.647, lng: -2.026, ref_station: 'Saint-Malo' },
  'calais': { lat: 50.9507, lng: 1.8733, ref_station: 'Calais' },
  'dunkerque': { lat: 51.033, lng: 2.371, ref_station: 'Dunkerque' },
  'lorient': { lat: 47.747, lng: -3.363, ref_station: 'Lorient' },
  'vannes': { lat: 47.650, lng: -2.760, ref_station: 'Vannes' },
  'saint-nazaire': { lat: 47.278, lng: -2.207, ref_station: 'Saint-Nazaire' },
  'nantes': { lat: 47.218, lng: -1.553, ref_station: 'Nantes' },
  'arcachon': { lat: 44.662, lng: -1.177, ref_station: 'Arcachon' },
  'bordeaux': { lat: 44.838, lng: -0.579, ref_station: 'Bordeaux' },
  'bayonne': { lat: 43.493, lng: -1.478, ref_station: 'Bayonne' },
  'hendaye': { lat: 43.378, lng: -1.785, ref_station: 'Hendaye' },
  'toulon': { lat: 43.124, lng: 5.931, ref_station: 'Toulon' },
  'marseille': { lat: 43.297, lng: 5.370, ref_station: 'Marseille' },
  'nice': { lat: 43.710, lng: 7.262, ref_station: 'Nice' },
  'antibes': { lat: 43.584, lng: 7.125, ref_station: 'Antibes' },
  'cannes': { lat: 43.553, lng: 7.017, ref_station: 'Cannes' },
  'sète': { lat: 43.399, lng: 3.696, ref_station: 'Sète' },
  'agde': { lat: 43.310, lng: 3.484, ref_station: 'Agde' },
  'port-de-bouc': { lat: 43.399, lng: 4.979, ref_station: 'Port-de-Bouc' },
  'concarneau': { lat: 47.877, lng: -3.914, ref_station: 'Concarneau' },
};

const INLAND_CITIES = {
  'paris': { lat: 48.856, lng: 2.352 },
  'lyon': { lat: 45.764, lng: 4.836 },
  'toulouse': { lat: 43.605, lng: 1.444 },
  'lille': { lat: 50.629, lng: 3.057 },
  'strasbourg': { lat: 48.573, lng: 7.752 },
  'montpellier': { lat: 43.611, lng: 3.877 },
  'arras': { lat: 50.290, lng: 2.783 },
};

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function fetchTidesFromAPI(lat, lng) {
  const url = `https://api-maree.fr/api/v1/heights?lon=${lng}&lat=${lat}&count=8`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API erreur (${response.status})`);
  }

  const data = await response.json();
  
  if (!data.heights || data.heights.length === 0) {
    throw new Error('Aucune donnée de marée trouvée');
  }

  const events = [];
  let lastWasHigher = null;

  for (let i = 0; i < data.heights.length; i++) {
    const h = data.heights[i];
    const dt = new Date(h.datetime);
    
    let isHigh = null;
    
    if (i === 0) {
      isHigh = data.heights[i+1] ? h.height > data.heights[i+1].height : null;
    } else if (i === data.heights.length - 1) {
      isHigh = h.height > data.heights[i-1].height;
    } else {
      const prevHeight = data.heights[i-1].height;
      const nextHeight = data.heights[i+1].height;
      isHigh = h.height > prevHeight && h.height > nextHeight;
      const isLow = h.height < prevHeight && h.height < nextHeight;
      if (!isHigh && !isLow) continue;
    }

    if (isHigh !== null && isHigh !== lastWasHigher) {
      events.push({
        date: dt.toISOString().split('T')[0],
        heure: dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        type: isHigh ? 'haute' : 'basse',
        hauteur_m: Math.round(h.height * 10) / 10,
        coefficient: null
      });
      lastWasHigher = isHigh;
    }
  }

  return events;
}

async function searchTideCity(cityName) {
  const search = cityName.toLowerCase().trim();
  
  if (COASTAL_CITIES[search]) {
    const city = COASTAL_CITIES[search];
    const events = await fetchTidesFromAPI(city.lat, city.lng);
    return {
      ville: cityName.charAt(0).toUpperCase() + cityName.slice(1),
      distance: 0,
      evenements: events
    };
  }

  for (let key in COASTAL_CITIES) {
    if (key.includes(search) || search.includes(key)) {
      const city = COASTAL_CITIES[key];
      const events = await fetchTidesFromAPI(city.lat, city.lng);
      return {
        ville: key.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        distance: 0,
        evenements: events
      };
    }
  }

  const inlandCoord = INLAND_CITIES[search];
  if (inlandCoord) {
    let nearest = null;
    let minDist = Infinity;
    
    for (let key in COASTAL_CITIES) {
      const city = COASTAL_CITIES[key];
      const dist = haversine(inlandCoord.lat, inlandCoord.lng, city.lat, city.lng);
      if (dist < minDist) {
        minDist = dist;
        nearest = { key, city, distance: Math.round(dist) };
      }
    }

    if (nearest) {
      const events = await fetchTidesFromAPI(nearest.city.lat, nearest.city.lng);
      return {
        ville: nearest.key.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        distance: nearest.distance,
        evenements: events
      };
    }
  }

  throw new Error(`Ville "${cityName}" non trouvée. Essayez une ville côtière (Brest, Cherbourg, etc.) ou une grande ville française.`);
}
