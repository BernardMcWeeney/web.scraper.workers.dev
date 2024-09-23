import html from './html.js'
import contentTypes from './content-types.js'
import Scraper from './scraper.js'
import { generateJSONResponse, generateErrorJSONResponse } from './json-response.js'

addEventListener('scheduled', event => {
  event.waitUntil(handleScheduled(event));
});

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleScheduled(event) {
  try {
    const { premiumDomains, allDomains } = await scrapeAndProcessDomains();

    const emailContent = generateEmailContent(premiumDomains, allDomains);

    await sendEmail(emailContent);

    console.log('Email sent successfully.');
  } catch (error) {
    console.error('Error in scheduled function:', error);
  }
}

async function handleRequest(request) {
  return new Response('This Worker runs on a schedule.', {
    headers: { 'Content-Type': 'text/plain' },
  });
}

async function scrapeAndProcessDomains() {
  // Fetch the domain deletion list
  const response = await fetch('https://www.weare.ie/deleted-domain-list/');
  const html = await response.text();

  // Extract domain names
  const domains = extractDomainNames(html);

  // Identify premium domains
  const premiumDomains = await identifyPremiumDomains(domains);

  return { premiumDomains, allDomains: domains };
}

function extractDomainNames(html) {
  const domains = [];
  const regex = /<li>(.*?)<\/li>/g;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const domain = match[1].trim();
    if (domain.endsWith('.ie')) {
      domains.push(domain);
    }
  }

  return domains;
}

async function identifyPremiumDomains(domains) {
  const premiumDomains = [];
  const dictionary = await getDictionaryWords();
  const namesList = await getNamesList();

  domains.forEach(domain => {
    const domainName = domain.replace('.ie', '').toLowerCase();

    // Criteria 1: Short names (5 letters or less)
    if (domainName.length <= 5) {
      premiumDomains.push(domain);
      return;
    }

    // Criteria 2: Dictionary words
    if (dictionary.has(domainName)) {
      premiumDomains.push(domain);
      return;
    }

    // Criteria 3: People's names
    if (namesList.has(domainName)) {
      premiumDomains.push(domain);
      return;
    }

    // Additional criteria can be added here
    // For example, checking for pronounceability or brandability
  });

  return premiumDomains;
}

async function getDictionaryWords() {
  // A small set of common English words for example purposes
  const words = ['apple', 'orange', 'banana', 'grape', 'peach']; // Extend this list as needed
  return new Set(words);
}

async function getNamesList() {
  // A small set of common first names for example purposes
  const names = ['john', 'jane', 'michael', 'sarah', 'david']; // Extend this list as needed
  return new Set(names);
}

function generateEmailContent(premiumDomains, allDomains) {
  const purchaseLinkBase = 'https://cp.blacknighthosting.com/cart.php?a=add&domain=register&query=';

  // Premium domains section
  let premiumSection = 'Premium Domains:\n\n';
  premiumDomains.forEach(domain => {
    const link = purchaseLinkBase + encodeURIComponent(domain);
    premiumSection += `- ${domain}: ${link}\n`;
  });

  // All domains section
  let allDomainsSection = 'All Deleted Domains:\n\n';
  allDomains.forEach(domain => {
    allDomainsSection += `- ${domain}\n`;
  });

  // Combine sections
  const emailBody = `${premiumSection}\n\n${allDomainsSection}`;

  return emailBody;
}

async function sendEmail(emailContent) {
  const apiKey = EMAIL_API_KEY; // Set this in your Cloudflare Worker environment variables
  const fromEmail = FROM_EMAIL; // Set this in your environment variables
  const toEmail = TO_EMAIL; // Set this in your environment variables

  const data = {
    personalizations: [
      {
        to: [{ email: toEmail }],
        subject: 'Daily Deleted .ie Domains Summary',
      },
    ],
    from: { email: fromEmail },
    content: [
      {
        type: 'text/plain',
        value: emailContent,
      },
    ],
  };

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send email: ${response.status} - ${errorText}`);
  }
}
