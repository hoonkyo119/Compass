import React from 'react';
import { newsCategories } from '@/lib/newsCategories';

const NewsPage = () => {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>News</h1>
      <p>This is the news page.</p>
      <ul>
        {newsCategories.map((category) => (
          <li key={category.id}>{category.name}</li>
        ))}
      </ul>
    </main>
  );
};

export default NewsPage;
