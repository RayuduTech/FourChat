/* MODULE : CMS Forward Integration  */

/* Description  : This Module describes all the facility to extract the 
data on daily basis from contact history and share the lead and vector file
to tectia.
Following integration were available in this program as per TSD,
1. AGENCY forward integration [End of process : share the data to tectia ] 
following agency channels are integrated :
	1. STARTEK
	2. TELEDIRECT_MSIG
	3. LMS
	4. HLWP
	5. ATLAS
	6. DIRECT_MAILER
	7. DIRECT_SALES
	8. HLA
	9. TELDIRECT_HLA
*/

/*==================== Start of the program ================*/
options mprint mlogic symbolgen;
%let UtilityLocation=/sasdata/export_files/FileWatcherUtility/;

%let logname= sftp_file_placing_code;
proc printto log="&UtilityLocation./logs/&logname._%left(%sysfunc(datetime(),B8601DT15.)).log"; run;

/*include libname file for db connection*/
%include '/sasdata/Generic/hlb_cms_library.sas';

/*channel lookup for agency list */

/*%let lookup_file = sftp_lookup_file.csv;*/
%let lookup_file = sftp_lookup_file.csv;
%let column_lookup_format = /sasdata/export_files/sftp_conf/&lookup_file;
%let lookup_output = channel_lookup;

%include '/sasdata/export_files/FileWatcherUtility/macros/cms_email_alert.sas';

/*extract max job id */
proc sql;
select max(id) into:max_job_id from cmdmlib.campaign_audit;
quit;


%if %sysevalf(&max_job_id =.,boolean) %then %do;
%let curr_job_id = 1;
%end;
%else %do;
%let curr_job_id = %eval(%sysfunc(int(&max_job_id))+1);
%end;

/*insert into audit table with start status */
proc sql;
insert into cmdmlib.campaign_audit
Values(
&curr_job_id,
"Agency_file_placing.sas",
" ",
'start',
%sysfunc(datetime())
);
quit;

/* **************** code block #0 *************** */
/* Description : load the channel lookup file and order file to perform the execution*/


/*load lookup file declared above */
options obs=max;
proc import 
datafile="&column_lookup_format" 
out=&lookup_output
dbms=csv
replace;
getnames=yes;
guessingrows=max;
run;

/*load column order table to create the lead file structure */

%let order_file = HLB_FORMAT_ORDER.csv;
%let column_order_format = /sasdata/export_files/column_order_format/&order_file;
%let order_output = HLB_FORMAT_ORDER;


options obs=max;
proc import 
datafile="&column_order_format" 
out=&order_output
dbms=csv
replace;
getnames=yes;
guessingrows=max;
run;

/* **************** code block #3 *************** */
/* Description : this macro will transfer the file created on compute serve to tectia sftp */


/*this macro will transfer the file created on compute serve to tectia sftp */

%macro transfer_to_sftp(campaign_id,
sftp_channel,
sftp_path,
sftp_host,
sftp_user,
sftp_file_path,
file_name);


%put ========= SFPT Details for the file transfer =========;
%put &=campaign_id;
%put &=sftp_channel;
%put &=sftp_path;
%put &=sftp_host;
%put &=sftp_user;
%put &=sftp_file_path;
%put &=file_name;

/*%let transfer_comamnd =  "echo put &file_path &sftp_path | sftpg3 &sftp_user@&sftp_host 2>&1";*/

/*filename sftpcmd pipe &transfer_comamnd;*/

%let cmdfile = /sasdata/export_files/FileWatcherUtility/ccnfg/&sftp_channel._sftpfile.txt;
filename sftpfile "&cmdfile";

data _null_;
file sftpfile;
put "cd &sftp_path";
put "put &sftp_file_path";
put 'bye';
run;

/*created input file;*/
%put ===== SFTP file ====;
data _null_;
infile sftpfile;
input;
put _infile_;
run;

%let logpath  = /sasdata/export_files/FileWatcherUtility/ccnfg/&sftp_channel._sftplog.txt;
%put &=logpath;

x "sftpg3 -B &cmdfile &sftp_user@&sftp_host > &logpath 2>&1";

%let transfer_status = none;

filename logfile "&logpath";
data _null_;
infile logfile;
input;
put _infile_;
if index(_infile_,"/&sftp_path") then call symput('transfer_status','directory_valid');
else if index(_infile_,'Error: CD failed: No such file or directory') then call symput('transfer_status','directory_not_found');
else if index(_infile_,"Error: No such file or directory, file: &SFTP_FILE_PATH") then call symput('transfer_status','Input_file_not_found');
else if index(_infile_,"100%") then call symput('transfer_status','success');
else if index(_infile_,"Authentication failed") then call symput('transfer_status','authentication_issue');
else if index(_infile_,"Unknown host-key") then call symput('transfer_status','unkown_host_key');
else if index(_infile_,"Error: Could not open connection to") then call symput('transfer_status','sftp_not_found');
run;

%put &=transfer_status;
%let status_tbl_nm = &channelname._TectiaStatus;

%put Transfer Status : &transfer_status.;

proc sql;
select max(auto_id) format=best32. into : max_auto_id from cmdmlib.sftp_audit;
quit;
%let curr_auto_id = %eval(&max_auto_id +1);

%put current auto id : &curr_auto_id;

%if &transfer_status = success %then %do;
	%put File transferred successfully.;
	data &status_tbl_nm;
		Message = 'File transferred successfully';
	run;
	
proc sql;
insert into cmdmlib.sftp_audit
Values(
&curr_auto_id,
"&campaign_id",
"&sftp_channel",
"&file_name",
"&sftp_file_path",
"sftp",
%sysfunc(datetime()),
%sysfunc(datetime()),
"Transfer successful",
'NA'
);
quit;

%end;


%else %if &transfer_status = directory_not_found %then %do;
	%put Error : Permission Denied.;
	data &status_tbl_nm;
		Message = 'Directory Not Found';
	run;

	proc sql;
insert into cmdmlib.sftp_audit
Values(
&curr_auto_id,
"&campaign_id",
"&sftp_channel",
"&file_name",
"&sftp_file_path",
"sftp",
%sysfunc(datetime()),
%sysfunc(datetime()),
'NA',
"Directory Not Found"
);
quit;

%end;


%else %if &transfer_status = Input_file_not_found %then %do;
	%put Error : Transfer Failed.;
	data &status_tbl_nm;
		Message = 'Input file not found';
	run;


%send_email(subject="Error : Tectia File Transfer failed for &file_name", 
text_msg="Input File Not found",
recipient_list=&email_list_export_error);
	
proc sql;
insert into cmdmlib.sftp_audit
Values(
&curr_auto_id,
"&campaign_id",
"&sftp_channel",
"&file_name",
"&sftp_file_path",
"sftp",
%sysfunc(datetime()),
%sysfunc(datetime()),
'NA',
"Input File Not found"
);
quit;

%end;

/*sftp_not_found*/

%else %if &transfer_status = sftp_not_found %then %do;
	%put Error : Transfer Failed.;
	data &status_tbl_nm;
		Message = 'Error Connecting SFTP';
	run;
	
%send_email(subject="Error : Tectia File Transfer failed for &file_name", 
text_msg="Error Connecting SFTP",
recipient_list=&email_list_export_error);

proc sql;
insert into cmdmlib.sftp_audit
Values(
&curr_auto_id,
"&campaign_id",
"&sftp_channel",
"&file_name",
"&sftp_file_path",
"sftp",
%sysfunc(datetime()),
%sysfunc(datetime()),
'NA',
"Authentication Failed"
);
quit;

%end;

%else %if &transfer_status = authentication_issue %then %do;
	%put Error : Transfer Failed.;
	data &status_tbl_nm;
		Message = 'Authentication Failed';
	run;
	
%send_email(subject="Error : Tectia File Transfer failed for &file_name", 
text_msg="Authentication Failed",
recipient_list=&email_list_export_error);

proc sql;
insert into cmdmlib.sftp_audit
Values(
&curr_auto_id,
"&campaign_id",
"&sftp_channel",
"&file_name",
"&sftp_file_path",
"sftp",
%sysfunc(datetime()),
%sysfunc(datetime()),
'NA',
"Authentication Failed"
);
quit;

%end;

%else %do;
	%put Error : Unknown Transfer Status.;
	data &status_tbl_nm;
		Message = 'Unknown Transfer Status';
	run;

	%send_email(subject="Error : Tectia File Transfer failed for &file_name", 
text_msg="Unknow Transfer Status Received from Tectia ",
recipient_list=&email_list_export_error);

proc sql;
insert into cmdmlib.sftp_audit
Values(
&curr_auto_id,
"&campaign_id",
"&sftp_channel",
"&file_name",
"&sftp_file_path",
"sftp",
%sysfunc(datetime()),
%sysfunc(datetime()),
'NA',
'Unknown Transfer Status'
);
quit;

%end;

%mend;

/* **************** code block #2 *************** */
/* Description : Process a channel and generate the lead file for today's execution */

%macro hlwp_code_file_creation;
%let today = %sysfunc(today(), yymmddn8.);

%let codefilepath = /sasdata/export_files/sftp_format/hlwp_default_code_files/;
%let eod_path = /sasdata/export_files/sftp_format/EOD/;
/*/sasdata/export_files/sftp_format/EOD/;*/

%let default_code_006 = CM3_CM30006_001.txt;
%let default_code_005 = CM3_CM30005_001.txt;
%let default_code_004 = CM3_CM30004_001.txt;


%let currcodefile_006 = &today._&default_code_006;
%let currcodefile_005 = &today._&default_code_005;
%let currcodefile_004 = &today._&default_code_004;

filename code006 "&codefilepath.&default_code_006";
filename code005 "&codefilepath.&default_code_005";
filename code004 "&codefilepath.&default_code_004";



filename ncode006 "&eod_path.&currcodefile_006";
filename ncode005 "&eod_path.&currcodefile_005";
filename ncode004 "&eod_path.&currcodefile_004";

data _null_;
infile code006 dlm='~' dsd;
file ncode006 dsd dlm="~";
input;
put _infile_;
run;

data _null_;
infile code005 dlm='~' dsd;
file ncode005 dsd dlm="~";
input;
put _infile_;
run;



data _null_;
infile code004 dlm='~' dsd;
file ncode004 dsd dlm="~";
input;
put _infile_;
run;

%transfer_to_sftp(
&curr_campaign_id,
&channelname,
sftp_path=&sftp_path,
sftp_host=&sftp_host,
sftp_user=&sftp_user,
sftp_file_path=&eod_path.&currcodefile_006,
file_name=&currcodefile_006);

%transfer_to_sftp(
&curr_campaign_id,
&channelname,
sftp_path=&sftp_path,
sftp_host=&sftp_host,
sftp_user=&sftp_user,
sftp_file_path=&eod_path.&currcodefile_005,
file_name=&currcodefile_005);

%transfer_to_sftp(
&curr_campaign_id,
&channelname,
sftp_path=&sftp_path,
sftp_host=&sftp_host,
sftp_user=&sftp_user,
sftp_file_path=&eod_path.&currcodefile_004,
file_name=&currcodefile_004);

/*place blank dmy file*/

%let dmy_code_006 = CM3_CM30006_001.dmy;
%let dmy_code_005 = CM3_CM30005_001.dmy;
%let dmy_code_004 = CM3_CM30004_001.dmy;

%let dmycodefile_006 = &today._&dmy_code_006;
%let dmycodefile_005 = &today._&dmy_code_005;
%let dmycodefile_004 = &today._&dmy_code_004;

filename dmy006 "&eod_path.&dmycodefile_006";
filename dmy005 "&eod_path.&dmycodefile_005";
filename dmy004 "&eod_path.&dmycodefile_004";

data _null_;
file dmy006;
put;
run;

data _null_;
file dmy005;
put;
run;

data _null_;
file dmy004;
put;
run;



%transfer_to_sftp(
&curr_campaign_id,
&channelname,
sftp_path=&sftp_path,
sftp_host=&sftp_host,
sftp_user=&sftp_user,
sftp_file_path=&eod_path.&dmycodefile_006,
file_name=&currcodefile_006);

%transfer_to_sftp(
&curr_campaign_id,
&channelname,
sftp_path=&sftp_path,
sftp_host=&sftp_host,
sftp_user=&sftp_user,
sftp_file_path=&eod_path.&dmycodefile_005,
file_name=&currcodefile_005);

%transfer_to_sftp(
&curr_campaign_id,
&channelname,
sftp_path=&sftp_path,
sftp_host=&sftp_host,
sftp_user=&sftp_user,
sftp_file_path=&eod_path.&dmycodefile_004,
file_name=&currcodefile_004);

%mend;


%macro processchannel(channelname,file_type,sftp_host,src_os_user,sftp_user,sftp_path,contact_tbl_nm);

%put &=channelname;
%put &=file_type;
%put &=sftp_host;
%put &=src_os_user;
%put &=sftp_user;
%put &=sftp_path;
%put &=contact_tbl_nm;
%let payload_cl_nm=;

/*%let payload_cl_nm = TeleDirectMSIG_LEAD;*/
title 'payload col list';
%let vector_file_flag =;

/*%let file_type=vector;*/
/*%let channelname=atlas;*/
%if %sysfunc(lowcase(&file_type)) = lead %then %do; 
%let payload_cl_nm = &channelname._LEAD;

%let vector_file_flag = false;
%put &=payload_cl_nm;

/*vector file name */




proc sql ;
select lowcase(&payload_cl_nm) into : payload_col_list separated by ','
from work.&order_output
where &payload_cl_nm is not null;
%put &payload_col_list;

select lowcase(&payload_cl_nm) into : retain_col_list separated by ' '
from work.&order_output
where &payload_cl_nm is not null;
%put &retain_col_list;

quit;

/*proc sql;*/
/*select compress(sas_campaign_id) into : lead_campaign_id */
/*from cmdmlib.&contact_tbl_nm;*/
/*quit;*/

/*create lead dataset */
proc sql;
create table work.&channelname._&file_type._TEMP as 
select distinct &payload_col_list
from cmdmlib.&contact_tbl_nm
where datepart(execution_timestamp) = today() and
(upcase(contact_code) = 'ELIGIBLE' or 
upcase(contact_code) = 'POLICY OFF') and segment_id like 'SEG%';
quit;

%if %sysfunc(lowcase(&channelname)) = lms %then %do;

data work.&channelname._&file_type;
retain &retain_col_list;
set work.&channelname._&file_type._TEMP;
format step_date yymmdd10.;
format leads_expiry_date yymmdd10.;
run;

%end;
%else %if %sysfunc(lowcase(&channelname)) = hlwp %then %do;

data work.&channelname._&file_type;
retain &retain_col_list;
set work.&channelname._&file_type._TEMP;
format step_date yymmdd10.;
format process_date yymmdd10.;
format leads_expiry_date yymmdd10.;
run;

%end;
%else %if %sysfunc(lowcase(&channelname)) = atlas %then %do;

data work.&channelname._&file_type;
retain &retain_col_list;
set work.&channelname._&file_type._TEMP;
format step_date yymmddn8.;
format var_data_1 yymmddn8.;
format date_of_birth yymmddn8.;
run;

%end;
%else %if %sysfunc(lowcase(&channelname)) = directsales %then %do;

data work.&channelname._&file_type;
retain &retain_col_list;
set work.&channelname._&file_type._TEMP;
drop race;
race_new = '';
rename race_new=race;
drop nationality;
nationality_new = '';
rename nationality_new=nationality;
drop occupation;
occupation_new = '';
rename occupation_new=occupation;
format step_date yymmddn8.;
format var_data_1 yymmddn8.;
format date_of_birth yymmddn8.;
run;

%end;
%else %do;
data work.&channelname._&file_type(keep= &retain_col_list);
retain &retain_col_list;
set work.&channelname._&file_type._TEMP;
format step_date yymmddn8.;
run;
%end;

%end;/* end of */

%if %sysfunc(lowcase(&file_type)) = vector %then %do; 
%let payload_cl_nm = &channelname._VECTOR;

%let vector_file_flag = true;
%put &=payload_cl_nm;

proc sql ;
select lowcase(&payload_cl_nm) into : payload_col_list separated by ','
from work.&order_output
where &payload_cl_nm is not null;
%put &payload_col_list;
quit;


proc sql;
create table work.&channelname._VT as 
select distinct &payload_col_list
from cmdmlib.&contact_tbl_nm
where datepart(execution_timestamp) = today() and
(upcase(contact_code) = 'ELIGIBLE' or 
upcase(contact_code) = 'POLICY OFF') and segment_id like 'SEG%';
quit;

data work.&channelname._&file_type;
rename sas_campaign_id=vector_id;
set work.&channelname._VT;
run;

%end;

%let today = %sysfunc(today(), yymmddn8.);
%let today_time = %sysfunc(compress(%sysfunc(time(),time.),%str( :)));
%put &=today_time;
%let filetype =;
%let MSIG_filename = CM2TELEDIRECT_Leads_&today.h.dat;
%let teledirecthla_filename = CM2TELEDIRECTHLA_Leads_&today..dat;
%let HLA_filename = CM2CCHLA_Leads_&today..dat;
%let STARTEK_filename = CM2VSOURCEHLA_Leads_&today.b.dat;
%let ATLAS_filename = &today._CM2ATLAS2_Leads.dat;
%let HLWP_filename = &today._CM3_CM30002_001.txt;
%let HLWP_DMY_filename = &today._CM3_CM30002_001.dmy;
%let Mailer_filename = PMtoDirectMailer_[campaignid]_Direct Mailer_&today..csv;
%let LMS_filename = CM2LMS_Leads_&today..dat;
%let DIRECTSALES_filename = &today._CM2ATLAS4_Leads.dat;
%let FB_filename =;
%let DIRECTMAILER_filename = ;


%let atlas_vector_filenm = &today._CM2ATLAS2_Vector.dat;
%let hlwp_vector_filenm  = &today._CM3_CM30001_001.txt;
%let hlwp_vector_dmy_filenm  = &today._CM3_CM30001_001.dmy;
%let lms_vector_filenm   = CM2LMS_Vector_&today..dat;
%let directsales_vector_nm = &today._CM2ATLAS4_Vector.dat;

/*hlwp new file namess */



%put &=MSIG_filename ;
%put &=teledirecthla_filename ;
%put &=HLA_filename;
%put &=STARTEK_filename ;
%put &=ATLAS_filename ;
%put &=HLWP_filename ;
%put &=Mailer_filename;
%put &=LMS_filename ;
%put &=directsales_filename ;

%let curr_campaign_id=;
%let curr_campaign_nm=;
%let sftp_file_name=;

%let filetype=;
proc sql;
select count(1) into : file_cnt from work.&channelname._&file_type;
quit;

%if %eval(&file_cnt > 0 ) %then %do; 

/*%let contact_tbl_nm = contact_startek;*/
proc sql outobs=1;
select distinct strip(sas_campaign_id) into : curr_campaign_id
from cmdmlib.&contact_tbl_nm
where datepart(execution_timestamp) = today();

select distinct campaign_name into : curr_campaign_nm
from cmdmlib.&contact_tbl_nm
where datepart(execution_timestamp) = today() and campaign_name is not null;

quit;

%let curr_campaign_id = %sysfunc(compress(&curr_campaign_id));
%let curr_campaign_nm = %sysfunc(compress(&curr_campaign_nm));

%let file_with_header = no;
%let file_delimiter = ~;

%if %sysfunc(Upcase(&channelname)) =  STARTEK %then %do;
%let sftp_file_name=&STARTEK_filename;
%let filetype = dat;
%put &=sftp_file_name;

%end;

%if %sysfunc(Upcase(&channelname)) =  TELEDIRECTMSIG %then %do;
%let sftp_file_name=&MSIG_filename;
%let filetype = dat;
%put &=sftp_file_name;

%end;

%if %sysfunc(Upcase(&channelname)) =  LMS %then %do;

%if %sysfunc(lowcase(&vector_file_flag)) = true %then %do;
%let sftp_file_name=&lms_vector_filenm;
%end;
%else %do;
%let sftp_file_name=&LMS_filename;
%end;

%let filetype = dat;
%put &=sftp_file_name;

%end;

%if %sysfunc(Upcase(&channelname)) =  HLWP %then %do;

%if %sysfunc(lowcase(&vector_file_flag)) = true %then %do;
%let sftp_file_name=&hlwp_vector_filenm;
%let hlwp_filename_dmy = &hlwp_vector_dmy_filenm;
%end;
%else %do;
%let sftp_file_name=&HLWP_filename;
%let hlwp_filename_dmy = &HLWP_DMY_filename;
%end;

%let filetype = dat;
%put &=sftp_file_name;
%end;

%if %sysfunc(Upcase(&channelname)) =  ATLAS %then %do;

%if %sysfunc(lowcase(&vector_file_flag)) = true %then %do;
%let sftp_file_name=&atlas_vector_filenm;
%end;
%else %do;
%let sftp_file_name=&ATLAS_filename;
%end;
%let filetype = dat;
%put &=sftp_file_name;

%end;

%if %sysfunc(Upcase(&channelname)) =  DIRECTMAILER %then %do;
%let sftp_file_name=CMStoDirectMailer_%sysfunc(compress(&curr_campaign_id))_DirectMailer_&today..csv;
%let filetype = dat;
%let file_with_header = no;
%let file_delimiter = |;
%put &=sftp_file_name;
%put &=filetype;
%put &=file_with_header;
%put &=file_delimiter;


%end;

%if %sysfunc(Upcase(&channelname)) =  DIRECTSALES %then %do;

%if %sysfunc(lowcase(&vector_file_flag)) = true %then %do;
%let sftp_file_name=&directsales_vector_nm;
%end;
%else %do;
%let sftp_file_name=&DIRECTSALES_filename;
%end;
%let filetype = dat;
%put &=sftp_file_name;



%end;

%if %sysfunc(Upcase(&channelname)) =  FACEBOOK %then %do;
%let sftp_file_name=CMStoFacebook_%sysfunc(compress(&curr_campaign_id))_%sysfunc(compress(&curr_campaign_nm))_&today..csv;
%put &=sftp_file_name;
%let file_with_header  = yes;
%let filetype = csv;

%put &=sftp_file_name;
%end;

%if %sysfunc(Upcase(&channelname)) =  HLA %then %do;
%let sftp_file_name=&HLA_filename;
%let filetype = dat;
%put &=sftp_file_name;


%end;


%if %sysfunc(Upcase(&channelname)) =  TELEDIRECTHLA %then %do;
%let sftp_file_name=&teledirecthla_filename;
%let filetype = dat;
%put &=sftp_file_name;
%end;

%if %sysfunc(Upcase(&channelname)) =  IAP %then %do;
%let sftp_file_name=&IAP_filename;
%let filetype = dat;
%put &=sftp_file_name;

proc sql;
create table work.&channelname._&file_type as 
select &payload_col_list
from cmdmlib.&contact_tbl_nm
where datepart(execution_timestamp) = today() and execution_type='BATCH';
quit;

%end;


/*filename placing code */
filename sftpfile "/sasdata/export_files/sftp_format/EOD/&sftp_file_name";


/*
Note : direct mailer file  actual extension is csv but in the code its file type = dat 
so that follwing code will be used to generate its lead file
*/

proc sql;
select count(1) into : lead_count  from work.&channelname._&file_type;
quit;

%if %eval(&lead_count > 0) %then %do;

%if %sysfunc(Upcase(&filetype)) = DAT %then %do;
data _null_;
set work.&channelname._&file_type;
file sftpfile dsd dlm="&file_delimiter";
put (_all_)(+0);
run;
%end;

%if %sysfunc(Upcase(&filetype)) = CSV  %then %do;

proc export data=work.&channelname._&file_type
outfile=sftpfile
dbms=csv
replace;
run;

%end;




%let sftp_filepath = /sasdata/export_files/sftp_format/EOD/&sftp_file_name;

%put export_process :&sftp_filepath;

%if %sysfunc(fileexist(&sftp_filepath)) %then %do;

%put Agency_file_placing_code : File exists at &sftp_filepath; 


data &channelname._Status;
status = "&sftp_file_name created successfully";
run;

/*call sftp transfer macro to transfer the file to tectia*/
%transfer_to_sftp(
&curr_campaign_id,
&channelname,
sftp_path=&sftp_path,
sftp_host=&sftp_host,
sftp_user=&sftp_user,
sftp_file_path=&sftp_filepath,
file_name=&sftp_file_name);


%if %sysfunc(Upcase(&channelname)) =  HLWP %then %do;

%put inside hlwp loop to create dmy file;
/*
HLWP dmy file
generate the additional dmy file and transfer to tectia;*/

/*filename placing code generate a blank file in case of hlwp with dmy extension*/

filename sftpfile "/sasdata/export_files/sftp_format/EOD/&hlwp_filename_dmy";

%let format_path=/sasdata/export_files/sftp_format/EOD/;

%put /sasdata/export_files/sftp_format/EOD/&hlwp_filename_dmy;
data _null_;
file sftpfile;
put;
run;

%let hlwp_filepath = &format_path.&hlwp_filename_dmy;

%transfer_to_sftp(
&curr_campaign_id,
&channelname,
sftp_path=&sftp_path,
sftp_host=&sftp_host,
sftp_user=&sftp_user,
sftp_file_path=&hlwp_filepath,
file_name=&sftp_file_name);

/*create code files and transfer*/
%hlwp_code_file_creation;

%end;

%end; /* end of file exisit loop*/
%else %do;

%put ' sftp file does not found at' &sftp_filepath;
%end;

%end; /* if count more than 1 loop*/

%else %do;
%put "&channelname :there is no data to share lead file";
%end;

%end; /*end of file comparison loop*/


%else %do;
%put "&channelname  has no campaign info to share for &today";
%end;


%mend;


/* **************** code block #1 *************** */
/* Description : loop each channel  and call the macro to oricess the sales/response file */

/* Loop through each channel and process files */
/* note if yu want to run for a single channel add this condition in below if condition " and upcase(channel_name) = 'LMS'" */
data _null_;
    set &lookup_output;
 if lowcase(file_type) in ('lead','vector') and upcase(channel_name) not in ('EDM','FACEBOOK','IAP','DIRECTMAILER')  then do;
call execute(cats('%nrstr(%processchannel(
									channelname=',strip(channel_name),
									',file_type=', strip(file_type), 
									', sftp_host =', strip(sftp_host ),
									', src_os_user=', strip(src_os_user),
									', sftp_user=', strip(sftp_user),
									', sftp_path=', strip(sftp_path),
									', contact_tbl_nm=', strip(contact_tbl_nm),
									'));'));
end;
run;


proc sql;
insert into cmdmlib.campaign_audit
Values(
&curr_job_id,
"Agency_file_placing.sas",
" ",
'End',
%sysfunc(datetime())
);
quit;

proc printto; run;
