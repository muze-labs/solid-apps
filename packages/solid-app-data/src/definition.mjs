// Source metadata only: SimplyFlow owns composition, bindings and rendering.
// The build supplies authored behavior source before bundling/minification.
export function exposeDefinition(view, options, sources) {
  const sections = [
    'templates',
    'styles',
    'commands',
    'actions',
    'shortcuts',
    'behaviors',
    'routes',
    'transformers'
  ];
  view.definition = {
    components: options.components,
    overrides: Object.fromEntries(
      sections.map((name) => [name, options[name] || {}])
    ),
    sources,
    get dependencies() {
      return Object.keys(view.api || {});
    },
    context: 'this.data, this.actions, this.api, this.runtime, this.container'
  };
  const destroy = view.destroy.bind(view);
  view.destroy = () => {
    if (!view.destroyed) {
      if (Object.hasOwn(view.actions || {}, 'cleanup')) {
        view.actions.cleanup();
      }
      destroy();
    }
  };
  return view;
}
