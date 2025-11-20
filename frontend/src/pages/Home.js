import React, { useEffect, useState } from 'react';

function Home() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.text();
      })
      .then((data) => {
        setMessage(data);
      })
      .catch((error) => {
        console.error('Error fetching data:', error);
        setMessage('Failed to fetch data from the backend.');
      });
  }, []);

  return (
    <div>
      <h1>Home Page</h1>
      <p>Welcome to the Trash-Seg application!</p>
      <h2>Backend Response:</h2>
      <p>{message}</p>
    </div>
  );
}

export default Home;