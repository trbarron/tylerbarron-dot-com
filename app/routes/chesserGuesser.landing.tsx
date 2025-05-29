import { useState } from 'react';
import { useNavigate, Link } from '@remix-run/react';
import { Navbar } from '~/components/Navbar';
import Footer from "~/components/Footer";
import { Subarticle } from '~/components/Subarticle';
import { Modal } from '~/components/Modal';

export default function ChesserGuesserLandingPage() {
  const [showModal, setShowModal] = useState(false);
  const [username, setUsername] = useState('');
  const navigate = useNavigate();

  const handleUsernameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(event.target.value);
  };

  const handlePlayDaily = () => {
    setShowModal(true);
  };

  const handleSubmitUsername = () => {
    navigate(`/ChesserGuesser/Daily/${username}`);
  };

  return (
    <div className="bg-background bg-fixed min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <div className='flex flex-col items-center justify-center'>
        <Subarticle subtitle="">
            <div className="w-full max-w-md p-8 space-y-4 bg-white shadow-md">
              {/* <div>
                <h2 className="text-2xl font-semibold">Daily Game</h2>
                <p className="text-gray-600">Challenge yourself with a new set of puzzles every day. Test your skills and see how you rank among other players.</p>
                <button onClick={handlePlayDaily} className="mt-4 bg-white text-black border-4 border-black px-6 py-3 font-extrabold uppercase tracking-wide hover:bg-black hover:text-white transition-all duration-100 w-full text-center">Play Daily</button>
              </div> */}
              {/* <div className="pt-6" /> */}
              {/* <hr className="pt-4 border-gray-300" /> */}
              <div>
                <h2 className="text-2xl font-semibold">Unlimited Game</h2>
                <p className="text-gray-600">Enjoy endless puzzles at your own pace</p>
                <Link to="/chesserGuesser/unlimited" className="mt-4 inline-block bg-white text-black border-4 border-black px-6 py-3 font-extrabold uppercase tracking-wide hover:bg-black hover:text-white transition-all duration-100 w-full text-center">Play Unlimited</Link>
              </div>
            </div>
          </Subarticle>
          <Subarticle subtitle="">
            <div className="w-full max-w-md p-8 space-y-4 bg-white shadow-md">
                <div>
                <h2 className="text-2xl font-semibold">Blog</h2>
                <p className="text-gray-600">Recap post on how this was created, learnings and experiences in releasing it</p>
                <Link to="/ChesserGuesser/Blog" className="mt-4 inline-block bg-white text-black border-4 border-black px-6 py-3 font-extrabold uppercase tracking-wide hover:bg-black hover:text-white transition-all duration-100 w-full text-center">Read</Link>
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
            <input type="text" value={username} onChange={handleUsernameChange} className="px-4 py-2 border-2 border-black w-full" placeholder="Username" />
            <button onClick={handleSubmitUsername} className="mt-4 bg-white text-black border-4 border-black px-6 py-3 font-extrabold uppercase tracking-wide hover:bg-black hover:text-white transition-all duration-100 w-full">Start Daily Game</button>
          </div>
        </Modal>
      )}
    </div>
  );
}