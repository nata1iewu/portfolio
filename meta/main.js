import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
async function loadData() {
    const data = await d3.csv('loc.csv', (row) => ({
        ...row,
        line: Number(row.line), // or just +row.line
        depth: Number(row.depth),
        length: Number(row.length),
        date: new Date(row.date + 'T00:00' + row.timezone),
        datetime: new Date(row.datetime),
    }));

    return data;
}

function processCommits(data) {
    return d3
        .groups(data, (d) => d.commit)
        .map(([commit, lines]) => {
            const first = lines[0];
            const { author, date, time, timezone, datetime } = first;

            const ret = {
                id: commit,
                url: 'https://github.com/nata1iewu/portfolio/commit/' + commit,
                author,
                date,
                time,
                timezone,
                datetime,
                hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
                totalLines: lines.length,
            };

            Object.defineProperty(ret, 'lines', {
                value: lines,
                writable: false,
                configurable: false,
                enumerable: false,
            });

            return ret;
        })
        .sort((a, b) => a.datetime - b.datetime);
}
function renderCommitInfo(data, commits) {
    const files = d3.groups(data, (d) => d.file);
    const stats = [
        ['Total lines of code', d3.format(',')(data.length)],
        ['Total commits', d3.format(',')(commits.length)],
        ['Files changed', d3.format(',')(files.length)],
        ['Average lines per commit', d3.format('.1f')(d3.mean(commits, (d) => d.totalLines))],
        ['Largest commit', d3.format(',')(d3.max(commits, (d) => d.totalLines)) + ' lines'],
        ['Average line length', d3.format('.1f')(d3.mean(data, (d) => d.length)) + ' characters'],
        ['Longest line', d3.format(',')(d3.max(data, (d) => d.length)) + ' characters'],
        ['Maximum nesting depth', d3.format(',')(d3.max(data, (d) => d.depth))],
    ];

    const dl = d3.select('#stats')
        .append('dl')
        .attr('class', 'stats-grid');

    for (const [label, value] of stats) {
        dl.append('div')
            .attr('class', 'stat')
            .call((item) => {
                item.append('dt').text(label);
                item.append('dd').text(value);
            });
    }
}

function renderScatterplot(commits) {
    const width = 900;
    const height = 500;
    const margin = { top: 25, right: 35, bottom: 65, left: 65 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select('#chart')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('role', 'img')
        .attr('aria-label', 'Scatterplot showing commit date and time of day');

    const plot = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleTime()
        .domain(d3.extent(commits, (d) => d.date))
        .range([0, innerWidth])
        .nice();

    const yScale = d3.scaleLinear()
        .domain([0, 24])
        .range([innerHeight, 0]);

    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(commits, (d) => d.totalLines)])
        .range([4, 17]);
    plot.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(''));

    plot.append('g')
        .attr('class', 'grid')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(-innerHeight).tickFormat(''));

    // Add axes.
    plot.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(yScale).tickFormat((hour) => {
            if (hour === 0 || hour === 24) return '12 AM';
            if (hour === 12) return '12 PM';
            return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
        }));

    plot.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale));

    svg.append('text')
        .attr('class', 'axis-label')
        .attr('x', margin.left + innerWidth / 2)
        .attr('y', height - 12)
        .attr('text-anchor', 'middle')
        .text('Commit date');

    svg.append('text')
        .attr('class', 'axis-label')
        .attr('transform', `translate(17,${margin.top + innerHeight / 2}) rotate(-90)`)
        .attr('text-anchor', 'middle')
        .text('Time of day');

    const tooltip = d3.select('#tooltip'); const dots = plot.append('g')
        .attr('class', 'dots')
        .selectAll('circle')
        .data(commits, (d) => d.id)
        .join('circle')
        .attr('class', 'commit-dot')
        .attr('cx', (d) => xScale(d.date))
        .attr('cy', (d) => yScale(d.hourFrac))
        .attr('r', (d) => radiusScale(d.totalLines))
        .attr('fill', '#4776a8')
        .attr('fill-opacity', 0.68)
        .attr('stroke', '#244766')
        .attr('stroke-width', 0.7)
        .on('pointerenter', function (event, d) {
            d3.select(this).classed('hovered', true);
            tooltip
                .style('display', 'block')
                .html(
                    `<strong>${d3.timeFormat('%b %-d, %Y')(d.date)}</strong><br>` +
                    `${d3.timeFormat('%-I:%M %p')(d.datetime)}<br>` +
                    `${d.totalLines} lines changed<br>` +
                    `Author: ${d.author}<br>` +
                    `Commit: ${d.id.slice(0, 7)}`
                );
        })
        .on('pointermove', (event) => {
            tooltip
                .style('left', `${event.pageX + 14}px`)
                .style('top', `${event.pageY + 14}px`);
        })
        .on('pointerleave', function () {
            d3.select(this).classed('hovered', false);
            tooltip.style('display', 'none');
        }); dots.sort((a, b) => b.totalLines - a.totalLines);

    const selectionSummary = d3.select('#selection-summary');

    function updateSelection(selectedCommits) {
        const selectedIds = new Set(selectedCommits.map((d) => d.id));

        dots.classed('selected', (d) => selectedIds.has(d.id))
            .attr('fill-opacity', (d) => selectedIds.has(d.id) ? 0.95 : 0.2);

        selectionSummary.selectAll('*').remove();

        selectionSummary.append('p')
            .attr('class', 'selection-count')
            .text(`${selectedCommits.length} commits selected`);

        const selectedLines = selectedCommits.flatMap((commit) => commit.lines);
        const languageCounts = d3.rollups(
            selectedLines,
            (rows) => rows.length,
            (d) => d.type
        ).sort((a, b) => d3.descending(a[1], b[1]));

        if (selectedCommits.length === 0) {
            selectionSummary.append('p')
                .text('Drag across the chart to select commits and see their language breakdown.');
            return;
        }

        selectionSummary.append('p').text('Lines by file type:');

        const list = selectionSummary.append('ul')
            .attr('class', 'language-list');

        list.selectAll('li')
            .data(languageCounts)
            .join('li')
            .text(([type, count]) => `${type}: ${count} lines`);
    } const brush = d3.brush()
        .extent([[0, 0], [innerWidth, innerHeight]])
        .on('start brush end', (event) => {
            if (!event.selection) {
                updateSelection([]);
                return;
            }

            const [[x0, y0], [x1, y1]] = event.selection;

            const selected = commits.filter((d) => {
                const x = xScale(d.date);
                const y = yScale(d.hourFrac);
                return x >= x0 && x <= x1 && y >= y0 && y <= y1;
            });

            updateSelection(selected);
        });

    plot.append('g')
        .attr('class', 'brush')
        .call(brush)
        .lower();

    updateSelection([]);
}
const data = await loadData();
const commits = processCommits(data);

renderCommitInfo(data, commits);
renderScatterplot(commits);