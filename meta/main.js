
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

async function loadData() {
    const data = await d3.csv('loc.csv', (row) => ({
        ...row,
        line: Number(row.line),
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
        ['COMMITS', d3.format(',')(commits.length)],
        ['FILES', d3.format(',')(files.length)],
        ['TOTAL LOC', d3.format(',')(data.length)],
        ['MAX DEPTH', d3.format(',')(d3.max(data, (d) => d.depth))],
        ['LONGEST LINE', d3.format(',')(d3.max(data, (d) => d.length))],
        ['MAX LINES', d3.format(',')(d3.max(commits, (d) => d.totalLines))],
    ];

    const statsContainer = d3.select('#stats');
    statsContainer.selectAll('*').remove();

    const dl = statsContainer
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
        .attr('class', 'grid x-grid')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(-innerHeight).tickFormat(''));

    plot.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(yScale).tickFormat((hour) => {
            if (hour === 0 || hour === 24) return '12 AM';
            if (hour === 12) return '12 PM';
            return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
        }));

    plot.append('g')
        .attr('class', 'axis x-axis')
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

    const tooltip = d3.select('#tooltip');

    function attachTooltip(selection) {
        selection
            .on('pointerenter', function (event, d) {
                d3.select(this).classed('hovered', true);
                tooltip
                    .style('display', 'block')
                    .html(
                        `<div style="font-weight: 600; margin-bottom: 0.3rem; font-size: 0.95rem;">${d3.timeFormat('%b %-d, %Y')(d.date)} at ${d3.timeFormat('%-I:%M %p')(d.datetime)}</div>` +
                        `<div><strong>${d.totalLines}</strong> lines edited</div>` +
                        `<div style="color: #666; margin-top: 0.2rem; font-size: 0.8rem;">Author: ${d.author}</div>` +
                        `<div style="font-family: monospace; color: #888; font-size: 0.75rem; margin-top: 0.1rem;">commit: ${d.id.slice(0, 7)}</div>`
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
            });
    }

    const dotGroup = plot.append('g')
        .attr('class', 'dots');

    const dots = dotGroup
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
        .call(attachTooltip);

    dots.sort((a, b) => b.totalLines - a.totalLines);

    const selectionSummary = d3.select('#selection-summary');

    function updateSelection(selectedCommits) {
        const selectedIds = new Set(selectedCommits.map((d) => d.id));

        dotGroup.selectAll('circle')
            .classed('selected', (d) => selectedIds.has(d.id))
            .attr('fill-opacity', (d) => selectedIds.has(d.id) ? 0.95 : 0.2);

        selectionSummary.selectAll('*').remove();

        if (selectedCommits.length === 0) {
            return;
        }

        selectionSummary.append('p')
            .attr('class', 'selection-count')
            .text(`${selectedCommits.length} commits selected`);

        const selectedLines = selectedCommits.flatMap((commit) => commit.lines);
        const totalLinesCount = selectedLines.length;

        const languageCounts = d3.rollups(
            selectedLines,
            (rows) => rows.length,
            (d) => d.type
        ).sort((a, b) => d3.descending(a[1], b[1]));

        const dl = selectionSummary.append('dl')
            .attr('class', 'language-breakdown');

        for (const [type, count] of languageCounts) {
            const percentage = totalLinesCount > 0
                ? d3.format('.1f')((count / totalLinesCount) * 100)
                : '0.0';

            const item = dl.append('div');
            item.append('dt').text(type.toUpperCase());
            item.append('dd').text(`${count} lines`);
            item.append('dd').text(`(${percentage}%)`);
        }
    }

    const brush = d3.brush()
        .extent([[0, 0], [innerWidth, innerHeight]])
        .on('start brush end', (event) => {
            if (!event.selection) {
                updateSelection([]);
                return;
            }

            const [[x0, y0], [x1, y1]] = event.selection;

            const selected = filteredCommits.filter((d) => {
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

    function updateScatterPlot(filteredCommits) {
        if (filteredCommits.length === 0) {
            dotGroup.selectAll('circle').remove();
            updateSelection([]);
            return;
        }

        xScale.domain(d3.extent(filteredCommits, (d) => d.date)).nice();

        plot.select('.x-axis')
            .call(d3.axisBottom(xScale));

        plot.select('.x-grid')
            .call(d3.axisBottom(xScale).tickSize(-innerHeight).tickFormat(''));

        const sortedCommits = d3.sort(
            filteredCommits,
            (d) => -d.totalLines
        );

        dotGroup
            .selectAll('circle')
            .data(sortedCommits, (d) => d.id)
            .join('circle')
            .attr('class', 'commit-dot')
            .attr('cx', (d) => xScale(d.date))
            .attr('cy', (d) => yScale(d.hourFrac))
            .attr('r', (d) => radiusScale(d.totalLines))
            .attr('fill', '#4776a8')
            .attr('fill-opacity', 0.68)
            .attr('stroke', '#244766')
            .attr('stroke-width', 0.7)
            .call(attachTooltip);

        updateSelection([]);
    }

    return updateScatterPlot;
}

const data = await loadData();
const commits = processCommits(data);

let commitProgress = 100;
let filteredCommits = commits;

const timeScale = d3
    .scaleTime()
    .domain([
        d3.min(commits, (d) => d.datetime),
        d3.max(commits, (d) => d.datetime),
    ])
    .range([0, 100]);

const slider = document.querySelector('#commit-progress');
const commitTime = document.querySelector('#commit-time');

renderCommitInfo(data, commits);

const updateScatterPlot = renderScatterplot(commits);
const colors = d3.scaleOrdinal(d3.schemeTableau10);
function updateFileDisplay(filteredCommits) {
    const lines = filteredCommits.flatMap((d) => d.lines);

    const files = d3
        .groups(lines, (d) => d.file)
        .map(([name, lines]) => {
            return { name, lines };
        })
        .sort((a, b) => b.lines.length - a.lines.length);

    const filesContainer = d3
        .select('#files')
        .selectAll('div')
        .data(files, (d) => d.name)
        .join(
            (enter) =>
                enter.append('div').call((div) => {
                    div.append('dt').call((dt) => {
                        dt.append('code');
                        dt.append('small');
                    });
                    div.append('dd');
                }),
        );

    filesContainer.select('dt > code').text((d) => d.name);
    filesContainer.select('dt > small')
        .text((d) => `${d.lines.length} lines`);
    filesContainer
        .select('dd')
        .selectAll('div')
        .data((d) => d.lines)
        .join('div')
        .attr('class', 'loc')
        .attr('style', (d) => `--color: ${colors(d.type)}`);
}
function onTimeSliderChange() {
    commitProgress = Number(slider.value);
    const commitMaxTime = timeScale.invert(commitProgress);

    commitTime.textContent = commitMaxTime.toLocaleString('en-US', {
        dateStyle: 'long',
        timeStyle: 'short',
    });

    filteredCommits = commits.filter(
        (d) => d.datetime <= commitMaxTime
    );

    updateScatterPlot(filteredCommits);
    updateFileDisplay(filteredCommits);
}

slider.addEventListener('input', onTimeSliderChange);

onTimeSliderChange();
d3.select('#scatter-story')
    .selectAll('.step')
    .data(commits)
    .join('div')
    .attr('class', 'step')
    .html(
        (d, i) => `
            On ${d.datetime.toLocaleString('en', {
            dateStyle: 'full',
            timeStyle: 'short',
        })},
            I made <a href="${d.url}" target="_blank">${i > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'
            }</a>.
            I edited ${d.totalLines} lines across ${d3.rollups(
                d.lines,
                (D) => D.length,
                (d) => d.file,
            ).length
            } files.
            Then I looked over all I had made, and I saw that it was very good.
        `,
    );
function onStepEnter(response) {
    const commit = response.element.__data__;

    filteredCommits = commits.filter(
        (d) => d.datetime <= commit.datetime
    );

    updateScatterPlot(filteredCommits);
    updateFileDisplay(filteredCommits);
}

const scroller = scrollama();

scroller
    .setup({
        container: '#scrolly-1',
        step: '#scrolly-1 .step',
    })
    .onStepEnter(onStepEnter);
