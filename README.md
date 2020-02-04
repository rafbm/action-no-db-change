# no-db-change

> _Don’t forget to cherry-pick and run the migration before merging. kthx_

## Usage

Enable in your Rails app by adding a `main.yml` file to your repo containing:

```yaml
on: [push, pull_request]

jobs:
  no_db_change_trigger_job:
    runs-on: ubuntu-latest
    name: no-db-change-trigger
    steps:
    - name: no-db-change
      id: no-db-change
      uses: rafbm/action-no-db-change@master
      with:
        github-token: ${{ secrets.GITHUB_TOKEN }}
```

After the action has run at least once, you may want to enable “**no-db-change**” as a [required status check](https://help.github.com/en/github/administering-a-repository/enabling-required-status-checks) in your repo settings.
