# Frontend - Team Lot of Opps

React + Vite + Redux frontend application.

## Project Structure

```
src/
├── App.jsx              # Root component
├── App.css              # App styling
├── main.jsx             # Application entry point
├── features/            # Redux feature slices
│   └── counterSlice.js  # Example counter feature
├── store/               # Redux store configuration
│   └── index.js         # Store setup
├── components/          # Reusable React components
├── pages/               # Page components
├── hooks/               # Custom React hooks
├── utils/               # Utility functions
└── styles/              # Global styles
    └── index.css        # Global CSS
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

The application will open at `http://localhost:5173`

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Technologies

- **React 18** - UI library
- **Vite 5** - Build tool and dev server
- **Redux Toolkit** - State management
- **React-Redux** - React bindings for Redux
- **ESLint** - Code linting

## Redux Structure

Redux stores are organized as feature slices using Redux Toolkit:

```javascript
// In features/counterSlice.js
const counterSlice = createSlice({
  name: 'counter',
  initialState: { value: 0 },
  reducers: {
    increment: (state) => { state.value += 1 },
    decrement: (state) => { state.value -= 1 },
  }
})

// Use in components
const count = useSelector((state) => state.counter.value)
const dispatch = useDispatch()
```

## Next Steps

1. Create components in `src/components/`
2. Add new feature slices to `src/features/`
3. Create pages in `src/pages/`
4. Add custom hooks in `src/hooks/`
5. Define utility functions in `src/utils/`
