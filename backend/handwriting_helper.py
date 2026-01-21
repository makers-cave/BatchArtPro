"""
Handwriting synthesis helper module.
Generates SVG handwriting from text using the handwriting-synthesis library.
"""
import os
import sys
import numpy as np
import svgwrite
import io

# Set TensorFlow logging before importing
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

# Add handwriting library to path
HANDWRITING_LIB_PATH = os.path.join(os.path.dirname(__file__), 'handwriting_lib')
sys.path.insert(0, HANDWRITING_LIB_PATH)

# Lazy loading of the model to avoid slow startup
_hand_instance = None

def get_hand():
    """Lazy load the Hand instance"""
    global _hand_instance
    if _hand_instance is None:
        from handwriting_synthesis.hand import Hand
        _hand_instance = Hand()
    return _hand_instance

def generate_handwriting_svg(
    lines: list,
    biases: list = None,
    styles: list = None,
    stroke_colors: list = None,
    stroke_widths: list = None,
    view_width: int = 1000
) -> str:
    """
    Generate handwriting SVG from text lines.
    
    Args:
        lines: List of text lines to convert to handwriting
        biases: List of bias values (0-1, higher = neater), default 0.75
        styles: List of style indices (0-11), default 9
        stroke_colors: List of stroke colors, default 'black'
        stroke_widths: List of stroke widths, default 2
        view_width: Width of the SVG viewbox
    
    Returns:
        SVG content as string
    """
    from handwriting_synthesis import drawing
    
    hand = get_hand()
    
    # Set defaults
    num_lines = len(lines)
    biases = biases or [0.75] * num_lines
    styles = styles or [9] * num_lines
    stroke_colors = stroke_colors or ['black'] * num_lines
    stroke_widths = stroke_widths or [2] * num_lines
    
    # Validate inputs
    valid_char_set = set(drawing.alphabet)
    for line_num, line in enumerate(lines):
        if len(line) > 75:
            raise ValueError(f"Line {line_num} exceeds 75 characters ({len(line)})")
        for char in line:
            if char not in valid_char_set:
                raise ValueError(f"Invalid character '{char}' in line {line_num}. Valid: {valid_char_set}")
    
    # Generate strokes using the RNN
    strokes = hand._sample(lines, biases=biases, styles=styles)
    
    # Convert strokes to SVG
    line_height = 60
    view_height = line_height * (len(strokes) + 1)
    
    # Create SVG in memory
    dwg = svgwrite.Drawing()
    dwg.viewbox(width=view_width, height=view_height)
    
    # Store paths for returning
    paths_data = []
    
    initial_coord = np.array([0, -(3 * line_height / 4)])
    for offsets, line, color, width in zip(strokes, lines, stroke_colors, stroke_widths):
        if not line:
            initial_coord[1] -= line_height
            continue
        
        offsets[:, :2] *= 1.5
        stroke_data = drawing.offsets_to_coords(offsets)
        stroke_data = drawing.denoise(stroke_data)
        stroke_data[:, :2] = drawing.align(stroke_data[:, :2])
        
        stroke_data[:, 1] *= -1
        stroke_data[:, :2] -= stroke_data[:, :2].min() + initial_coord
        stroke_data[:, 0] += (view_width - stroke_data[:, 0].max()) / 2
        
        prev_eos = 1.0
        p = "M{},{} ".format(0, 0)
        for x, y, eos in zip(*stroke_data.T):
            p += '{}{},{} '.format('M' if prev_eos == 1.0 else 'L', x, y)
            prev_eos = eos
        
        path = svgwrite.path.Path(p)
        path = path.stroke(color=color, width=width, linecap='round').fill("none")
        dwg.add(path)
        
        paths_data.append({
            'path': p,
            'color': color,
            'width': width
        })
        
        initial_coord[1] -= line_height
    
    # Return SVG as string
    svg_string = dwg.tostring()
    
    return svg_string, view_width, view_height, paths_data


def generate_handwriting_svg_simple(text: str, style: int = 9, bias: float = 0.75, 
                                     color: str = 'black', width: int = 2) -> dict:
    """
    Simple interface to generate handwriting from a single text block.
    
    Args:
        text: Text to convert (can have newlines)
        style: Handwriting style (0-11)
        bias: Neatness bias (0-1, higher = neater)
        color: Stroke color
        width: Stroke width
    
    Returns:
        Dict with svg, width, height, paths
    """
    # Split text into lines
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    if not lines:
        raise ValueError("No text provided")
    
    num_lines = len(lines)
    
    svg_content, svg_width, svg_height, paths = generate_handwriting_svg(
        lines=lines,
        biases=[bias] * num_lines,
        styles=[style] * num_lines,
        stroke_colors=[color] * num_lines,
        stroke_widths=[width] * num_lines
    )
    
    return {
        'svg': svg_content,
        'width': svg_width,
        'height': svg_height,
        'paths': paths
    }
