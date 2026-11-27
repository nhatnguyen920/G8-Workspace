/* Exact precomputed notebook statistics; this file only renders the views. */
(() => {
  'use strict';
  const source = document.getElementById('interactive-chart-data');
  if (!source || !window.Plotly) return; // Original PNGs remain available.
  const specs = JSON.parse(source.textContent);
  const mounted = new Set();
  const pending = new Map();
  const vi = document.documentElement.lang === 'vi';
  let expanded = null;
  const modal = document.createElement('dialog');
  modal.className = 'chart-dialog';
  modal.setAttribute('aria-label', vi ? 'Biểu đồ phóng to' : 'Expanded chart');
  document.body.append(modal);
  function colors() {
    const css = getComputedStyle(document.documentElement);
    return {ink: css.getPropertyValue('--ink').trim(), muted: css.getPropertyValue('--muted').trim(),
      line: css.getPropertyValue('--line').trim(), paper: css.getPropertyValue('--paper').trim()};
  }
  function wrap(text, length = 20) {
    const words = String(text).replace(/_/g,' ').split(' '); let line = ''; const lines = [];
    for (const word of words) {
      if (line && line.length + word.length > length) {lines.push(line); line = word;}
      else line += (line ? ' ' : '') + word;
    }
    if (line) lines.push(line);
    return lines.join('<br>');
  }
  function layoutFor(figure, spec) {
    const c = colors(), small = figure.clientWidth < 550;
    const layout = structuredClone(spec.layout);
    layout.separators = ', ';
    layout.autosize = true;
    layout.margin = {l: 30, r: small ? 18 : 35, t: 32, b: 48};
    layout.font = {family: 'Plus Jakarta Sans, system-ui, sans-serif', size: small ? 11 : 12, color: c.ink};
    layout.paper_bgcolor = c.paper; layout.plot_bgcolor = c.paper;
    layout.hoverlabel = {bgcolor: c.paper, bordercolor: c.line, font: {color: c.ink, size: 13}};
    layout.dragmode = 'zoom'; layout.hovermode = 'closest';
    for (const name of Object.keys(layout).filter(k => /^[xy]axis[0-9]*$/.test(k))) {
      layout[name] = {...layout[name], color: c.muted, gridcolor: c.line, zerolinecolor: c.line,
        tickfont: {size: small ? 10 : 12}, automargin: true};
      if (small && layout[name].title && typeof layout[name].title === 'object') {
        layout[name].title.text = wrap(layout[name].title.text, 32);
      }
    }
    if (spec.data[0].orientation === 'h' && spec.data[0].type === 'bar') {
      layout.yaxis.tickmode = 'array'; layout.yaxis.tickvals = spec.data[0].y;
      layout.yaxis.ticktext = spec.data[0].y.map(x => wrap(x, small ? 17 : 27));
    }
    if (spec.key === 'corr') layout.xaxis.tickfont = layout.yaxis.tickfont = {size: small ? 9 : 11};
    return layout;
  }
  function size(figure, spec) {
    const plot = figure.querySelector('.interactive-plot');
    const height = expanded && expanded.figure === figure
      ? Math.max(280, modal.clientHeight - figure.querySelector('.chart-toolbar').offsetHeight)
      : spec.height;
    plot.style.height = height + 'px';
    return plot;
  }
  async function render(figure) {
    if (pending.has(figure)) return pending.get(figure);
    if (mounted.has(figure)) return;
    const spec = specs[figure.dataset.figureId]; if (!spec) return;
    const operation = (async () => {
      const plot = size(figure, spec);
      plot.dataset.ready = 'loading';
      try {
        await Plotly.newPlot(plot, structuredClone(spec.data), layoutFor(figure, spec), {
          responsive: true, displaylogo: false, displayModeBar: 'hover', scrollZoom: false,
          doubleClick: 'reset', modeBarButtonsToRemove: ['select2d','lasso2d','autoScale2d'],
          toImageButtonOptions: {format: 'png', filename: 'sato-' + spec.key, scale: 2}
        });
        plot.dataset.ready = 'true'; figure.classList.add('is-ready'); mounted.add(figure);
      } catch (error) {
        plot.dataset.ready = 'false'; figure.classList.remove('is-ready');
        console.error('Interactive chart failed; PNG retained:', spec.key, error);
      }
    })();
    pending.set(figure, operation); await operation; pending.delete(figure);
  }
  function resize(figure) {
    if (!mounted.has(figure)) return;
    const plot = size(figure, specs[figure.dataset.figureId]);
    Plotly.Plots.resize(plot);
  }
  modal.addEventListener('close', () => {
    if (!expanded) return;
    const {figure, marker, button} = expanded; expanded = null;
    marker.replaceWith(figure); button.textContent = vi ? 'Phóng to' : 'Expand';
    button.setAttribute('aria-label', vi ? 'Phóng to biểu đồ' : 'Expand chart');
    requestAnimationFrame(() => {resize(figure); button.focus({preventScroll:true});});
  });
  for (const figure of document.querySelectorAll('.interactive-chart')) {
    figure.querySelector('.chart-reset').addEventListener('click', async () => {
      await render(figure);
      if (!mounted.has(figure)) return;
      const spec = specs[figure.dataset.figureId], l = layoutFor(figure, spec);
      const patch={};
      for (const axis of Object.keys(l).filter(k => /^[xy]axis[0-9]*$/.test(k))) {
        patch[axis]={...l[axis],autorange:l[axis].autorange || !l[axis].range};
      }
      Plotly.relayout(figure.querySelector('.interactive-plot'),patch);
    });
    figure.querySelector('.chart-expand').addEventListener('click', async event => {
      if (expanded) {modal.close(); return;}
      const marker = document.createComment('chart position');
      const button = event.currentTarget;
      figure.before(marker); expanded = {figure, marker, button}; modal.append(figure);
      button.textContent = vi ? 'Thu nhỏ' : 'Close';
      button.setAttribute('aria-label', vi ? 'Đóng biểu đồ phóng to' : 'Close expanded chart');
      modal.showModal(); await render(figure); requestAnimationFrame(() => resize(figure));
    });
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {render(entry.target); observer.unobserve(entry.target);}
    }, {rootMargin: '450px'});
    document.querySelectorAll('.interactive-chart').forEach(x => observer.observe(x));
  } else document.querySelectorAll('.interactive-chart').forEach(render);
  new MutationObserver(() => {
    const c = colors();
    mounted.forEach(figure => {
      const patch={'font.color':c.ink,paper_bgcolor:c.paper,plot_bgcolor:c.paper,
        'hoverlabel.bgcolor':c.paper,'hoverlabel.font.color':c.ink,'hoverlabel.bordercolor':c.line};
      for (const axis of Object.keys(specs[figure.dataset.figureId].layout).filter(k => /^[xy]axis[0-9]*$/.test(k))) {
        patch[axis+'.color']=c.muted;patch[axis+'.gridcolor']=c.line;patch[axis+'.zerolinecolor']=c.line;
      }
      Plotly.relayout(figure.querySelector('.interactive-plot'),patch);
    });
  }).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
  window.addEventListener('resize', () => mounted.forEach(resize));
})();
