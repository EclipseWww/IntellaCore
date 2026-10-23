import React from 'react';
import PageUnavailable from './PageUnavailable';

export default class RouteErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('页面加载失败', error, info);
  }

  render() {
    return this.state.failed ? <PageUnavailable failed /> : this.props.children;
  }
}
