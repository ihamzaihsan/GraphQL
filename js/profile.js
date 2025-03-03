import { logout, isAuthenticated, getToken } from './auth.js';
import { getUserInfo, getUserXP, getUserAudits, getUserFinshedProjects} from './graphql.js';

// Check authentication
if (!isAuthenticated()) {
    window.location.href = 'index.html';
}

// DOM Elements
const userInfoElement = document.getElementById('userInfo');
const logoutBtn = document.getElementById('logoutBtn');
const xpGraph = document.getElementById('xpGraph');
const auditGraph = document.getElementById('auditGraph');

// Event Listeners
logoutBtn.addEventListener('click', logout);

const getCssVar = (varName) => 
    getComputedStyle(document.documentElement)
        .getPropertyValue(varName)
        .trim();

// Load user data
const loadUserData = async () => {
    try {
        const userInfo = await getUserInfo();
        const xpData = await getUserXP();
        const auditData = await getUserAudits();
        const FinshProjects = await getUserFinshedProjects();
        
        
        console.log('User Info:', userInfo);
        console.log('XP Data:', xpData);
        console.log('Audit Data:', auditData);
        console.log('FinshProjects:', FinshProjects);
        
        
        
        displayUserInfo(userInfo.user);
        if (xpData.transaction && xpData.transaction.length > 0) {
            createXPGraph(xpData.transaction);
        }
        createAuditGraph({
            transaction: auditData.up,
            transaction1: auditData.down
        });

        displayCompletedProjects();
        
    } catch (error) {
        console.error('GraphQL Error:', error);
    }
};


// Display user information
const displayUserInfo = (user) => {
    // Extract user data from the first element in the array
    const userData = user[0];
    
    // Get name components or use fallbacks
    const firstName = userData.firstName || userData.attrs?.firstName || "";
    const lastName = userData.lastName || userData.attrs?.lastName || "";
    const fullName = `${firstName} ${lastName}`.trim() || "Not specified";
    
    // Get location information
    const city = userData.addressCity || userData.attrs?.addressCity || "";
    const country = userData.addressCountry || userData.attrs?.addressCountry || "";
    const location = [city, country].filter(Boolean).join(", ") || "Not specified";
    
    // Get level information
    const level = userData.transactions && userData.transactions.length > 0 ? 
             userData.transactions[0].amount : "";

    const campusName = userData.campus || "Not specified"
    
    userInfoElement.innerHTML = `
        <h2>User Information</h2>
        <p><strong>Full Name:</strong> ${fullName}</p>
        <p><strong>Username:</strong> ${userData.login}</p>
        <p><strong>Email:</strong> ${userData.email}</p>
        <p><strong>Campus Location:</strong> ${campusName}</p>
        <p><strong>Lives in:</strong> ${location}</p>
        <p><strong>Level:</strong> ${level}</p>
    `;
};

const createXPGraph = (transactions) => {
  const svg = d3.select('.xp-progression-svg');
  const tooltip = d3.select('.xp-tooltip');
  
  // Remove hover line element
  svg.select('.hover-line').remove();

  // Data processing
  let cumulativeXP = 0;
  const data = transactions.map(t => {
      cumulativeXP += t.amount;
      return {
          date: new Date(t.createdAt),
          xp: cumulativeXP,
          delta: t.amount
      };
  });

  // Dimensions
  const width = 800;
  const height = 400;
  const margin = { top: 0, right: 40, bottom: 60, left: 70 };

  //function to convert XP to KB
  const xpToKB = (xp) => {
    return (xp / 1000).toFixed(2);
  };

  // Scales
  const xScale = d3.scaleTime()
      .domain(d3.extent(data, d => d.date))
      .range([margin.left, width - margin.right]);

  const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.xp)])
      .nice()
      .range([height - margin.bottom, margin.top]);

  // Line generator
  const line = d3.line()
      .x(d => xScale(d.date))
      .y(d => yScale(d.xp))
      .curve(d3.curveMonotoneX);

  // Area generator
  const area = d3.area()
      .x(d => xScale(d.date))
      .y0(yScale(0))
      .y1(d => yScale(d.xp))
      .curve(d3.curveMonotoneX);

  // Animated path drawing
  svg.select('.xp-path')
      .datum(data)
      .attr('d', area)
      .transition()
      .duration(1500)
      .attrTween('d', function(d) {
          const interpolate = d3.interpolateArray([], d);
          return t => area(interpolate(t));
      });

  svg.select('.xp-line')
      .datum(data)
      .attr('d', line)
      .style('stroke-dasharray', '1000')
      .style('stroke-dashoffset', '1000')
      .transition()
      .duration(1500)
      .ease(d3.easeCubicInOut)
      .style('stroke-dashoffset', '0');

  // Interactive points
  const points = svg.select('.data-points')
      .selectAll('.data-point')
      .data(data)
      .enter().append('circle')
      .attr('class', 'data-point')
      .attr('cx', d => xScale(d.date))
      .attr('cy', d => yScale(d.xp))
      .attr('r', 0)
      .attr('fill', getCssVar('--accent-primary'))
      .transition()
      .delay((d,i) => i * 50)
      .duration(300)
      .attr('r', 4);

  // Add interactivity
  svg.on('mousemove', (event) => {
      const [xCoord] = d3.pointer(event);
      const bisectDate = d3.bisector(d => d.date).left;
      const x0 = xScale.invert(xCoord);
      const i = bisectDate(data, x0, 1);
      const d = data[i];
      
      if (d) {
          // Convert SVG coordinates to screen coordinates
          const svgNode = svg.node();
          const point = svgNode.createSVGPoint();
          point.x = xScale(d.date);
          point.y = yScale(d.xp);
          const screenCoords = point.matrixTransform(svgNode.getScreenCTM());
          
          // Get container offset
          const container = d3.select('.xp-graph-container').node();
          const containerRect = container.getBoundingClientRect();
          
          // Position tooltip relative to container
          tooltip.style('opacity', 1)
              .html(`
                  <div class="tooltip-content">
                      <strong>${d3.timeFormat('%b %d, %Y')(d.date)}</strong>
                      <div>Total XP: ${xpToKB(d.xp)} KB</div>
                      <div>+${xpToKB(d.delta)} KB</div>
                  </div>
              `)
              .style('left', `${screenCoords.x - containerRect.left}px`)
              .style('top', `${screenCoords.y - containerRect.top - 40}px`);
      }
  }).on('mouseleave', () => {
      tooltip.style('opacity', 0);
  });

  // Axes
  const xAxis = d3.axisBottom(xScale)
      .ticks(d3.timeMonth.every(1))
      .tickSizeOuter(0)
      .tickFormat(d3.timeFormat('%b %Y'));

  const yAxis = d3.axisLeft(yScale)
      .ticks(5)
      .tickFormat(d => `${d3.format('.2s')(d)} XP`);

  svg.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(xAxis)
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)');

  svg.append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${margin.left},0)`)
      .call(yAxis);
};

// Create Audit Ratio Graph
const createAuditGraph = ({ transaction: upTransactions, transaction1: downTransactions }) => {
    // Decimal MB conversion (1 MB = 1,000,000 bytes)
    const bytesToMB = (bytes) => (bytes / 1000000).toFixed(2);
    
    const totalUp = upTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalDown = downTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    // Calculate ratio as totalDown/totalUp with one decimal point
    const ratio = totalUp > 0 
        ? (totalUp / totalDown ).toFixed(1)
        : '0.0'; // Handle division by zero

    const centerX = 200;
    const centerY = 130;
    const radius = 100;
    const innerRadius = 60;
    
    const createDonutPath = (startAngle, endAngle) => {
        const start = {
            xOuter: centerX + radius * Math.cos(startAngle),
            yOuter: centerY + radius * Math.sin(startAngle),
            xInner: centerX + innerRadius * Math.cos(startAngle),
            yInner: centerY + innerRadius * Math.sin(startAngle)
        };
        
        const end = {
            xOuter: centerX + radius * Math.cos(endAngle),
            yOuter: centerY + radius * Math.sin(endAngle),
            xInner: centerX + innerRadius * Math.cos(endAngle),
            yInner: centerY + innerRadius * Math.sin(endAngle)
        };
        
        const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
        
        return `M ${start.xOuter} ${start.yOuter}
                A ${radius} ${radius} 0 ${largeArc} 1 ${end.xOuter} ${end.yOuter}
                L ${end.xInner} ${end.yInner}
                A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${start.xInner} ${start.yInner}
                Z`;
    };

    auditGraph.innerHTML = `
        <svg viewBox="0 0 400 300" width="100%" height="100%">
            <defs>
                <filter id="shadow">
                    <feDropShadow dx="2" dy="2" stdDeviation="2" flood-opacity="0.2"/>
                </filter>
                <linearGradient id="gradient-up" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#4CAF50"/>
                    <stop offset="100%" stop-color="#2E7D32"/>
                </linearGradient>
                <linearGradient id="gradient-down" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#FF5252"/>
                    <stop offset="100%" stop-color="#D32F2F"/>
                </linearGradient>
            </defs>
            
            <!-- Background Circle -->
            <path d="${createDonutPath(0, Math.PI * 2)}" fill="#eee" filter="url(#shadow)"/>
            
            <!-- Done Transactions -->
            <path class="slice" d="${createDonutPath((totalDown / (totalDown + totalUp)) * Math.PI * 2, Math.PI * 2)}" 
                  fill="url(#gradient-down)" filter="url(#shadow)"/>
            
            <!-- Received Transactions -->
            <path class="slice" d="${createDonutPath(0, (totalDown / (totalUp + totalDown)) * Math.PI * 2)}"
                  fill="url(#gradient-up)" filter="url(#shadow)"/>
            
            <!-- Center Text -->
            <g transform="translate(200, 130)">
                <circle r="50" fill="white" opacity="0.9"/>
                <text text-anchor="middle" dy="-10" font-size="32" font-weight="700" fill="#2E7D32">
                    ${ratio}
                </text>
                <text text-anchor="middle" dy="20" font-size="14" fill="#666">
                    Ratio
                </text>
            </g>
            
            <!-- Legend -->
            <g transform="translate(50, 255)">
                <rect width="16" height="16" fill="url(#gradient-up)" rx="3"/>
                <text x="24" y="13" font-size="14">Done: ${bytesToMB(totalUp)} MB</text>
            </g>
            <g transform="translate(230, 255)">
                <rect width="16" height="16" fill="url(#gradient-down)" rx="3"/>
                <text x="24" y="13" font-size="14">Received: ${bytesToMB(totalDown)} MB</text>
            </g>
        </svg>
    `;
};

const displayCompletedProjects = async () => {
    try {
        // Fetch projects data
        const response = await getUserFinshedProjects();
        
        // Extract the projects array based on the actual response structure
        let projects = [];
        if (response?.user && Array.isArray(response.user)) {
            // If the response has a user array, get the first user's projectEx
            projects = response.user[0]?.projectEx || [];
        }

        const tableBody = document.querySelector('.projects-table tbody');
        
        // Clear existing rows
        tableBody.innerHTML = '';
        
        // Format date function
        const formatDate = (dateString) => {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        };
        
        // Create table rows
        projects.forEach(project => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${project.object?.name || 'N/A'}</td>
                <td><span class="xp-badge">${(project.amount / 1000).toFixed(2)} KB</span></td>
                <td class="date-cell">${formatDate(project.createdAt)}</td>
                <td>
                    <a href="https://learn.reboot01.com/intra${project.path}" 
                       target="_blank" 
                       rel="noopener noreferrer">
                        View Project
                    </a>
                </td>

            `;
            
            tableBody.appendChild(row);
        });
        
        // Add empty state if no projects
        if (projects.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        No completed projects found
                    </td>
                </tr>
            `;
        }
        
    } catch (error) {
        console.error('Error loading completed projects:', error);
        document.querySelector('.projects-table tbody').innerHTML = `
            <tr>
                <td colspan="5" class="error-state">
                    Error loading projects. Please try again later.
                </td>
            </tr>
        `;
    }
};

// Initialize
loadUserData();
