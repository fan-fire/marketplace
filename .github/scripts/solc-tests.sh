echo $(pwd)
# cd ../../
# echo $(pwd)
printenv
# if CI is set, then we are running on github need to install eveyrthing
if [ "$CI" == "true" ]; then
    echo "CI is set"
    npm i truffle
    npm ci
    npm install -g ganache-cli
else
    echo "CI is not set"
fi

screen -d -S ganache -m ganache-cli -h 0.0.0.0 -p 8545 --networkId 4447
npm test >>test_output.tmp
screen -S ganache -X quit
npm run sizes >>sizes_output.tmp
npm run solhint:marketplace >>solhint_output.tmp
# npm run coverage >>coverage_output.tmp

# Cleaning up files
# cat coverage_output.tmp | sed -n -e '/-----------------------/,$p' | sed -r "s/\x1B\[([0-9]{1,3}(;[0-9]{1,2})?)?[mGK]//g" >>coverage_output.log
cat test_output.tmp | sed -n -e '/----------------------------------------/,$p' | sed -r "s/\x1B\[([0-9]{1,3}(;[0-9]{1,2})?)?[mGK]//g" >>test_output.log
cat sizes_output.tmp | sed -n -e '/──────────────────────────────────────────────/,$p' | sed -r "s/\x1B\[([0-9]{1,3}(;[0-9]{1,2})?)?[mGK]//g" >>sizes_output.log
cat solhint_output.tmp >>solhint_output.log

echo 'Coverage Deactivated'>>coverage_output.log

sed -i 's/                                              / /g' sizes_output.log
sed -i 's/──────────────────────────────────────────────/─/g' sizes_output.log

sed -i '1s/^/```\n/' coverage_output.log
sed -i '1s/^/```\n/' test_output.log
sed -i '1s/^/```\n/' sizes_output.log
sed -i '1s/^/```\n/' solhint_output.log

sed -i '1s/^/# Coverage\n/' coverage_output.log
sed -i '1s/^/# Gas\n/' test_output.log
sed -i '1s/^/# Sizes\n/' sizes_output.log
sed -i '1s/^/# Linting\n/' solhint_output.log

echo '```' >>coverage_output.log
echo '```' >>test_output.log
echo '```' >>sizes_output.log
echo '```' >>solhint_output.log

rm -v test_output.tmp
rm -v sizes_output.tmp
rm -v solhint_output.tmp
# rm -v coverage_output.tmp
