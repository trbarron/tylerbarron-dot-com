# Multiple Choice Chess — Game Concept

Multiple Choice Chess is a two-player chess variant where players never type or drag a move. Instead, on each turn a chess engine secretly analyzes the position and offers four candidate moves. The four options are the engine's 1st, 2nd, 4th, and 6th best moves, presented in shuffled order with no labels. You pick one, it plays on the board, and only then do you find out which rank you chose.

The result is a game that feels like chess trivia as much as chess. You are not just trying to win — you are also trying to identify which move the engine considers best. Stronger players will recognize the best move more often; weaker players will still make reasonable moves because all four options are legal and engine-approved. The format naturally compresses the skill gap without removing it.

Scoring rewards better picks (4 points for rank 1, down to 1 point for rank 6), so you can track your decision quality across a game independently of the match result. You could lose the game while outscoring your opponent in move quality, or win while playing sloppily.

Because the engine runs locally in the browser, no server-side computation is needed beyond coordinating the two players. The game works on any modern device including smartphones.
