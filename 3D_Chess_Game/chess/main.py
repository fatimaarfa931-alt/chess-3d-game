from ursina import *
import chess

app = Ursina()

# Camera setup
camera.position = (3.5, 8, -6)
camera.look_at((3.5, 0, 3.5))

board = chess.Board()

# Colors
color_light_square = color.rgba(240, 217, 181, 255)
color_dark_square = color.rgba(181, 136, 99, 255)
color_white_piece = color.white
color_black_piece = color.gray

# State
selected_square = None
piece_entities = {}

PIECE_MODELS = {
    chess.PAWN: ('sphere', (0.5, 0.5, 0.5)),
    chess.ROOK: ('cube', (0.6, 0.8, 0.6)),
    chess.KNIGHT: ('cone', (0.6, 0.8, 0.6)),
    chess.BISHOP: ('cylinder', (0.5, 1.0, 0.5)),
    chess.QUEEN: ('sphere', (0.7, 1.5, 0.7)),
    chess.KING: ('cube', (0.8, 1.6, 0.8)),
}

class ChessSquare(Button):
    def __init__(self, x_pos, y_pos):
        self.file = x_pos
        self.rank = y_pos
        is_light = (x_pos + y_pos) % 2 != 0
        base_color = color_light_square if is_light else color_dark_square
        
        super().__init__(
            parent=scene,
            model='cube',
            color=base_color,
            position=(x_pos, 0, y_pos),
            scale=(1, 0.1, 1),
            collider='box'
        )
        self.base_color = base_color
        
    def on_click(self):
        handle_click(self.file, self.rank)

squares = {}

def init_board():
    for x in range(8):
        for y in range(8):
            sq = ChessSquare(x, y)
            squares[(x, y)] = sq

def render_pieces():
    # clear existing pieces
    for entity in piece_entities.values():
        destroy(entity)
    piece_entities.clear()
    
    for x in range(8):
        for y in range(8):
            square_index = chess.square(x, y)
            piece = board.piece_at(square_index)
            if piece:
                model_name, scale = PIECE_MODELS[piece.piece_type]
                piece_color = color_white_piece if piece.color == chess.WHITE else color_black_piece
                
                entity = Entity(
                    parent=scene,
                    model=model_name,
                    color=piece_color,
                    position=(x, 0.05 + scale[1]/2, y),
                    scale=scale,
                    collider=None # we click the square underneath
                )
                piece_entities[(x, y)] = entity

def highlight_squares():
    # Reset colors
    for (x, y), sq in squares.items():
        sq.color = sq.base_color
        
    if selected_square:
        x, y = selected_square
        squares[(x, y)].color = color.yellow
        
        # Highlight legal moves
        square_index = chess.square(x, y)
        for move in board.legal_moves:
            if move.from_square == square_index:
                to_file = chess.square_file(move.to_square)
                to_rank = chess.square_rank(move.to_square)
                squares[(to_file, to_rank)].color = color.green

def handle_click(x, y):
    global selected_square
    
    clicked_sq_index = chess.square(x, y)
    piece_at_click = board.piece_at(clicked_sq_index)
    
    if selected_square:
        # Check if we clicked a valid move
        from_sq_index = chess.square(selected_square[0], selected_square[1])
        move = chess.Move(from_sq_index, clicked_sq_index)
        
        # Handle pawn promotion (auto promote to queen for simplicity)
        if board.piece_at(from_sq_index) and board.piece_at(from_sq_index).piece_type == chess.PAWN:
            if (board.turn == chess.WHITE and y == 7) or (board.turn == chess.BLACK and y == 0):
                move = chess.Move(from_sq_index, clicked_sq_index, promotion=chess.QUEEN)

        if move in board.legal_moves:
            board.push(move)
            selected_square = None
            render_pieces()
            highlight_squares()
        else:
            # If clicked on own piece, select it instead
            if piece_at_click and piece_at_click.color == board.turn:
                selected_square = (x, y)
                highlight_squares()
            else:
                selected_square = None
                highlight_squares()
    else:
        # Select piece if it's our turn
        if piece_at_click and piece_at_click.color == board.turn:
            selected_square = (x, y)
            highlight_squares()

init_board()
render_pieces()

# Adding a simple UI text to show whose turn it is
turn_text = Text(text="White's Turn", position=(-0.85, 0.45), scale=2)

def update():
    if board.is_game_over():
        turn_text.text = f"Game Over! Result: {board.result()}"
    else:
        turn_text.text = "White's Turn" if board.turn == chess.WHITE else "Black's Turn"

if __name__ == '__main__':
    app.run()
