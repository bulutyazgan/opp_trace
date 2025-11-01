const axios = require('axios');


const api_key = '';
const url = 'https://api.scrapingdog.com/profile';


// Your list of LinkedIn profile URLs or IDs
const profiles = [
 'https://www.linkedin.com/in/bulut-yazgan/',
 'https://www.linkedin.com/in/aaditya-nair-82032a287/',
 // add more profiles here
];


async function fetchProfiles() {
 for (const profile of profiles) {
   const params = {
     api_key: api_key,
     type: 'profile',
     id: profile,       // profile URL or LinkedIn ID
     premium: 'false'
   };


   try {
     const res = await axios.get(url, { params });
     console.log(`Profile: ${profile}`);
     console.log(res.data);
     console.log('--------------------------');
   } catch (err) {
     console.error(`Error fetching ${profile}:`, err.response?.data || err.message);
   }
 }
}


fetchProfiles();