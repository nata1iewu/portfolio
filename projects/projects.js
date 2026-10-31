import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { fetchJSON, renderProjects } from '../global.js';
const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
renderProjects(projects, projectsContainer, 'h2');
const projectsTitle = document.querySelector('.projects-title')
if (projectsTitle) {
    projectsTitle.textContent = `My Projects (${projects.length})`;
}
let arcGenerator = d3
    .arc()
    .innerRadius(0)
    .outerRadius(50);

let selectedYear = null;
function renderPieChart(projectsGiven) {
    d3.select('#projects-pie-plot').selectAll('path').remove();
    d3.select('.legend').selectAll('li').remove();
    let data = d3.rollups(
        projectsGiven,
        (v) => v.length,
        (d) => d.year
    ).map(([year, count]) => {
        return {
            value: count,
            label: year
        };
    });

    let sliceGenerator = d3.pie().value((d) => d.value);

    let arcData = sliceGenerator(data);

    let arcs = arcData.map((d) => arcGenerator(d));

    //     let colors = d3.scaleOrdinal([
    //     '#313B2D',
    //     '#586952',
    //     '#71816A',
    //     '#89917D',
    //     '#A0AA94',
    //     '#BAC3AE'
    // ]);
    let colors = d3.scaleOrdinal(d3.schemeTableau10);
    arcs.forEach((arc, idx) => {
        d3.select('#projects-pie-plot')
            .append('path')
            .attr('d', arc)
            .attr('fill', colors(idx))
            .classed('selected', selectedYear === data[idx].label)
            .on('click', () => {
                selectedYear = selectedYear === data[idx].label
                    ? null
                    : data[idx].label;

                d3.select('#projects-pie-plot')
                    .selectAll('path')
                    .classed('selected', (d, i) => selectedYear === data[i].label);

                d3.select('.legend')
                    .selectAll('li')
                    .classed('selected', (d, i) => selectedYear === data[i].label);

                updateProjects();
            });
    });
    let legend = d3.select('.legend');

    data.forEach((d, idx) => {
        legend
            .append('li')
            .attr('style', `--color:${colors(idx)}`)
            .classed('selected', selectedYear === d.label)
            .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
    });
}
renderPieChart(projects);

let searchInput = document.querySelector('#search');

function updateProjects() {
    let query = searchInput.value.toLowerCase();

    let filteredProjects = projects.filter((project) => {
        let values = Object.values(project).join('\n').toLowerCase();
        let matchesSearch = values.includes(query);
        let matchesYear = selectedYear === null || project.year == selectedYear;

        return matchesSearch && matchesYear;
    });

    renderProjects(filteredProjects, projectsContainer, 'h2');
    renderPieChart(
        projects.filter((project) => {
            let values = Object.values(project).join('\n').toLowerCase();
            return values.includes(query);
        })
    );
}

searchInput.addEventListener('input', updateProjects);