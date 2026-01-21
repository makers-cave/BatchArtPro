import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

const EditorContext = createContext();

export const useEditor = () => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
};

// Initial state
const initialState = {
  template: {
    id: null,
    name: 'Untitled Template',
    description: '',
    settings: {
      width: 1080,
      height: 1080,
      backgroundColor: '#ffffff',
      snapToGrid: true,
      gridSize: 10,
      showGrid: true,
    },
    elements: [],
  },
  selectedElementIds: [],
  clipboard: null,
  zoom: 1,
  pan: { x: 0, y: 0 },
  tool: 'select', // select, pan, text, rectangle, circle, line
  isDirty: false,
  history: [],
  historyIndex: -1,
  dataSource: null,
  activeTab: 'editor',
};

// Action types
const ActionTypes = {
  SET_TEMPLATE: 'SET_TEMPLATE',
  UPDATE_TEMPLATE: 'UPDATE_TEMPLATE',
  ADD_ELEMENT: 'ADD_ELEMENT',
  UPDATE_ELEMENT: 'UPDATE_ELEMENT',
  DELETE_ELEMENTS: 'DELETE_ELEMENTS',
  SELECT_ELEMENTS: 'SELECT_ELEMENTS',
  CLEAR_SELECTION: 'CLEAR_SELECTION',
  SET_ZOOM: 'SET_ZOOM',
  SET_PAN: 'SET_PAN',
  SET_TOOL: 'SET_TOOL',
  COPY_ELEMENTS: 'COPY_ELEMENTS',
  PASTE_ELEMENTS: 'PASTE_ELEMENTS',
  REORDER_ELEMENTS: 'REORDER_ELEMENTS',
  UNDO: 'UNDO',
  REDO: 'REDO',
  PUSH_HISTORY: 'PUSH_HISTORY',
  SET_DATA_SOURCE: 'SET_DATA_SOURCE',
  SET_ACTIVE_TAB: 'SET_ACTIVE_TAB',
  RESET_DIRTY: 'RESET_DIRTY',
};

// Reducer
function editorReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_TEMPLATE:
      return {
        ...state,
        template: action.payload,
        isDirty: false,
        history: [],
        historyIndex: -1,
      };

    case ActionTypes.UPDATE_TEMPLATE:
      return {
        ...state,
        template: { ...state.template, ...action.payload },
        isDirty: true,
      };

    case ActionTypes.ADD_ELEMENT: {
      const newElements = [...state.template.elements, action.payload];
      return {
        ...state,
        template: { ...state.template, elements: newElements },
        selectedElementIds: [action.payload.id],
        isDirty: true,
      };
    }

    case ActionTypes.UPDATE_ELEMENT: {
      const elements = state.template.elements.map(el =>
        el.id === action.payload.id ? { ...el, ...action.payload.updates } : el
      );
      return {
        ...state,
        template: { ...state.template, elements },
        isDirty: true,
      };
    }

    case ActionTypes.DELETE_ELEMENTS: {
      const elements = state.template.elements.filter(
        el => !action.payload.includes(el.id)
      );
      return {
        ...state,
        template: { ...state.template, elements },
        selectedElementIds: [],
        isDirty: true,
      };
    }

    case ActionTypes.SELECT_ELEMENTS:
      return {
        ...state,
        selectedElementIds: action.payload,
      };

    case ActionTypes.CLEAR_SELECTION:
      return {
        ...state,
        selectedElementIds: [],
      };

    case ActionTypes.SET_ZOOM:
      return {
        ...state,
        zoom: Math.max(0.1, Math.min(5, action.payload)),
      };

    case ActionTypes.SET_PAN:
      return {
        ...state,
        pan: action.payload,
      };

    case ActionTypes.SET_TOOL:
      return {
        ...state,
        tool: action.payload,
      };

    case ActionTypes.COPY_ELEMENTS: {
      const copiedElements = state.template.elements.filter(
        el => state.selectedElementIds.includes(el.id)
      );
      return {
        ...state,
        clipboard: copiedElements,
      };
    }

    case ActionTypes.PASTE_ELEMENTS: {
      if (!state.clipboard?.length) return state;
      const pastedElements = state.clipboard.map(el => ({
        ...el,
        id: uuidv4(),
        x: el.x + 20,
        y: el.y + 20,
        name: `${el.name} (copy)`,
      }));
      return {
        ...state,
        template: {
          ...state.template,
          elements: [...state.template.elements, ...pastedElements],
        },
        selectedElementIds: pastedElements.map(el => el.id),
        isDirty: true,
      };
    }

    case ActionTypes.REORDER_ELEMENTS: {
      const { elementId, direction } = action.payload;
      const elements = [...state.template.elements];
      const index = elements.findIndex(el => el.id === elementId);
      if (index === -1) return state;

      if (direction === 'up' && index < elements.length - 1) {
        [elements[index], elements[index + 1]] = [elements[index + 1], elements[index]];
      } else if (direction === 'down' && index > 0) {
        [elements[index], elements[index - 1]] = [elements[index - 1], elements[index]];
      } else if (direction === 'top') {
        const [el] = elements.splice(index, 1);
        elements.push(el);
      } else if (direction === 'bottom') {
        const [el] = elements.splice(index, 1);
        elements.unshift(el);
      }

      // Update zIndex based on array position
      elements.forEach((el, i) => {
        el.zIndex = i;
      });

      return {
        ...state,
        template: { ...state.template, elements },
        isDirty: true,
      };
    }

    case ActionTypes.PUSH_HISTORY: {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(action.payload);
      // Keep max 50 history entries
      if (newHistory.length > 50) newHistory.shift();
      return {
        ...state,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }

    case ActionTypes.UNDO: {
      if (state.historyIndex <= 0) return state;
      const newIndex = state.historyIndex - 1;
      const snapshot = state.history[newIndex];
      return {
        ...state,
        template: { ...state.template, elements: snapshot.elements },
        historyIndex: newIndex,
        isDirty: true,
      };
    }

    case ActionTypes.REDO: {
      if (state.historyIndex >= state.history.length - 1) return state;
      const newIndex = state.historyIndex + 1;
      const snapshot = state.history[newIndex];
      return {
        ...state,
        template: { ...state.template, elements: snapshot.elements },
        historyIndex: newIndex,
        isDirty: true,
      };
    }

    case ActionTypes.SET_DATA_SOURCE:
      return {
        ...state,
        dataSource: action.payload,
      };

    case ActionTypes.SET_ACTIVE_TAB:
      return {
        ...state,
        activeTab: action.payload,
      };

    case ActionTypes.RESET_DIRTY:
      return {
        ...state,
        isDirty: false,
      };

    default:
      return state;
  }
}

// Provider component
export const EditorProvider = ({ children }) => {
  const [state, dispatch] = useReducer(editorReducer, initialState);
  const historyTimeoutRef = useRef(null);

  // Helper to push history with debounce
  const pushHistory = useCallback((action) => {
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
    }
    historyTimeoutRef.current = setTimeout(() => {
      dispatch({
        type: ActionTypes.PUSH_HISTORY,
        payload: {
          action,
          elements: JSON.parse(JSON.stringify(state.template.elements)),
          timestamp: Date.now(),
        },
      });
    }, 300);
  }, [state.template.elements]);

  // Actions
  const actions = {
    setTemplate: (template) => {
      dispatch({ type: ActionTypes.SET_TEMPLATE, payload: template });
    },

    updateTemplate: (updates) => {
      dispatch({ type: ActionTypes.UPDATE_TEMPLATE, payload: updates });
    },

    addElement: (element) => {
      const newElement = {
        id: uuidv4(),
        zIndex: state.template.elements.length,
        ...element,
      };
      dispatch({ type: ActionTypes.ADD_ELEMENT, payload: newElement });
      pushHistory('Add element');
      return newElement.id;
    },

    updateElement: (id, updates) => {
      dispatch({ type: ActionTypes.UPDATE_ELEMENT, payload: { id, updates } });
      pushHistory('Update element');
    },

    deleteElements: (ids) => {
      dispatch({ type: ActionTypes.DELETE_ELEMENTS, payload: ids });
      pushHistory('Delete elements');
    },

    selectElements: (ids, addToSelection = false) => {
      if (addToSelection) {
        const newSelection = [...new Set([...state.selectedElementIds, ...ids])];
        dispatch({ type: ActionTypes.SELECT_ELEMENTS, payload: newSelection });
      } else {
        dispatch({ type: ActionTypes.SELECT_ELEMENTS, payload: ids });
      }
    },

    clearSelection: () => {
      dispatch({ type: ActionTypes.CLEAR_SELECTION });
    },

    setZoom: (zoom) => {
      dispatch({ type: ActionTypes.SET_ZOOM, payload: zoom });
    },

    setPan: (pan) => {
      dispatch({ type: ActionTypes.SET_PAN, payload: pan });
    },

    setTool: (tool) => {
      dispatch({ type: ActionTypes.SET_TOOL, payload: tool });
    },

    copyElements: () => {
      dispatch({ type: ActionTypes.COPY_ELEMENTS });
    },

    pasteElements: () => {
      dispatch({ type: ActionTypes.PASTE_ELEMENTS });
      pushHistory('Paste elements');
    },

    reorderElement: (elementId, direction) => {
      dispatch({ type: ActionTypes.REORDER_ELEMENTS, payload: { elementId, direction } });
      pushHistory('Reorder element');
    },

    undo: () => {
      dispatch({ type: ActionTypes.UNDO });
    },

    redo: () => {
      dispatch({ type: ActionTypes.REDO });
    },

    setDataSource: (dataSource) => {
      dispatch({ type: ActionTypes.SET_DATA_SOURCE, payload: dataSource });
    },

    setActiveTab: (tab) => {
      dispatch({ type: ActionTypes.SET_ACTIVE_TAB, payload: tab });
    },

    resetDirty: () => {
      dispatch({ type: ActionTypes.RESET_DIRTY });
    },

    // Get selected elements
    getSelectedElements: () => {
      return state.template.elements.filter(el => state.selectedElementIds.includes(el.id));
    },
  };

  return (
    <EditorContext.Provider value={{ state, actions }}>
      {children}
    </EditorContext.Provider>
  );
};
