const core = require('@actions/core')
const github = require('@actions/github')

const getDbFiles = (files) => files.filter(file => /^db[^\/]*\//.test(file.filename))
const CHECK_NAME = 'no-db-change'

async function run() {
  let githubToken = core.getInput('github-token')

  let payload = github.context.payload

  //
  // In "push" actions, we get:
  //
  //   "owner": { "name": "..." }
  //
  // In "pull_request" actions, we get:
  //
  //   "owner": { "login": "..." }
  //
  // Go figure.
  //
  let repoOwner = payload.repository.owner.name || payload.repository.owner.login
    , repoName = payload.repository.name

  let octokit = new github.GitHub(githubToken)

  let { data: pulls } = await octokit.pulls.list({
    owner: repoOwner,
    repo: repoName,
    state: 'open',
  })

  let pullData = await Promise.all(pulls.map(async (pull) => {
    return {
      number: pull.number,
      title: pull.title,
      branch: pull.head.ref,
      sha: pull.head.sha,
    }
  }))

  console.log('Open pull requests:')

  for (let pull of pullData) {
    console.log(`\n#${pull.number} - ${pull.title}`)

    let { data: { check_runs: checks } } = await octokit.checks.listForRef({
      owner: repoOwner,
      repo: repoName,
      ref: pull.sha,
    })
    let check = checks.filter(c => c.name == CHECK_NAME && c.head_sha == pull.sha)[0]

    let compare = await octokit.request(`GET /repos/heliom/missive-api/compare/master...${pull.branch}`)
      , dbFiles = getDbFiles(compare.data.files)
      , conclusion, output

    if (dbFiles.length) {
      conclusion = 'failure'
      output = {
        title: 'Branch contains changes to `db` directory',
        summary: dbFiles.join("\n"),
      }
    } else {
      conclusion = 'success'
      output = {
        title: 'Branch contains no changes to `db` directory',
        summary: 'Merge at will.'
      }
    }

    if (check) {
      if (check.conclusion != conclusion) {
        if (conclusion == 'success') {
          console.log(`🌴 #${pull.number} - ${pull.branch}: Update new SUCCESS check`)
        } else {
          console.log(`🚨 #${pull.number} - ${pull.branch}: Create new FAILURE check`)
        }

        octokit.checks.update({
          owner: repoOwner,
          repo: repoName,
          check_run_id: check.id,
          status: 'completed',
          conclusion,
          // Getting error "Empty value for parameter 'output.summary': undefined"
          // output,
        })
      }
    } else {
      if (conclusion == 'success') {
        console.log(`🌴 #${pull.number} - ${pull.branch}: Create new check with SUCCESS state`)
      } else {
        console.log(`🚨 #${pull.number} - ${pull.branch}: Create new FAILURE check`)
      }

      await octokit.checks.create({
        owner: repoOwner,
        repo: repoName,
        name: CHECK_NAME,
        head_sha: pull.sha,
        status: 'completed',
        conclusion,
        // Getting error "Empty value for parameter 'output.summary': undefined"
        // output,
      })
    }
  }
}

try {
  run()
} catch (error) {
  core.setFailed(error.message)
}
