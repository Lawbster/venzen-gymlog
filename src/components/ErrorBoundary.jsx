import { Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      errorMessage: '',
    }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected UI error',
    }
  }

  componentDidCatch(error) {
    console.error('App render error:', error)
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <main
        style={{
          margin: '0 auto',
          padding: '24px 16px',
          maxWidth: '680px',
          minHeight: '100vh',
        }}
      >
        <section
          style={{
            border: '1px solid #d5decf',
            borderRadius: '12px',
            background: '#ffffffd9',
            padding: '16px',
            display: 'grid',
            gap: '10px',
          }}
        >
          <h1>Something went wrong</h1>
          <p>The app hit an unexpected error while rendering.</p>
          <p>
            <small>{this.state.errorMessage}</small>
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </section>
      </main>
    )
  }
}

export default ErrorBoundary
