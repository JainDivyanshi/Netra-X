import { Routes, Route } from 'react-router-dom';
import Builder from './pages/Builder';

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Builder />} />
    </Routes>
  );
};

export default App;