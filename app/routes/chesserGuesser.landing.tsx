import { useState } from 'react';
import { useNavigate, Link } from '@remix-run/react';
import { Navbar } from '~/components/Navbar';
import { Footer } from '~/components/Footer';
import { Subarticle } from '~/components/Subarticle';
import { Modal } from '~/components/Modal';

export default function ChesserGuesserLandingPage() {
  const [showModal, setShowModal] = useState(false);
  const [username, setUsername] = useState('');
  const navigate = useNavigate();

  const handleUsernameChange = (event) => {
    setUsername(event.target.value);
  };

  const handlePlayDaily = () => {
    console.log('play daily');
    setShowModal(true);
  };

  const handleSubmitUsername = () => {
    navigate(`/ChesserGuesserDaily/${username}`);
  };

  return (
    <div className="bg-background bg-fixed min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <div className='flex flex-col items-center justify-center'>
          <Subarticle>
            <div className="w-full max-w-md p-8 space-y-4 bg-white shadow-md rounded-lg">
              <div>
                <h2 className="text-2xl font-semibold">Daily Game</h2>
                <p className="text-gray-600">Challenge yourself with a new set of puzzles every day. Test your skills and see how you rank among other players.</p>
                <button onClick={handlePlayDaily} className="mt-4 inline-block bg-gray text-offWhite font-bold py-2 px-4 rounded hover:bg-gray-dark w-full text-center">Play Daily</button>
              </div>
              <div className="pt-6" />
              <hr className="pt-4 border-gray-300" />
              <div>
                <h2 className="text-2xl font-semibold">Unlimited Game</h2>
                <p className="text-gray-600">Enjoy endless puzzles at your own pace. A great way to practice and improve your chess evaluation skills without any pressure.</p>
                <Link to="/ChesserGuesserUnlimited" className="mt-4 inline-block bg-gray-300 text-offBlack font-bold py-2 px-4 rounded hover:bg-gray-400 w-full text-center">Play Unlimited</Link>
              </div>
            </div>
          </Subarticle>
          <Subarticle>
            <div className="w-full max-w-md p-8 space-y-4 bg-white shadow-md rounded-lg">
              <div>
                <h2 className="text-2xl font-semibold">Blog</h2>
                <p className="text-gray-600">Recap post on how this was created, learnings and experiences in releasing it.</p>
                <Link to="/ChesserGuesserBlog" className="mt-4 inline-block bg-gray-300 text-offBlack font-bold py-2 px-4 rounded hover:bg-gray-400 w-full text-center">Read</Link>
              </div>
            </div>
          </Subarticle>
        </div>
      </main>
      <Footer />

      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <div className="p-4 bg-white">
            <h2 className="text-xl font-semibold mb-4">Enter Username</h2>
            <input type="text" value={username} onChange={handleUsernameChange} className="px-4 py-2 border rounded-lg w-full" placeholder="Username" />
            <button onClick={handleSubmitUsername} className="mt-4 bg-gray text-offWhite font-bold py-2 px-4 rounded hover:bg-gray-dark w-full">Start Daily Game</button>
          </div>
        </Modal>
      )}
    </div>
  );
}